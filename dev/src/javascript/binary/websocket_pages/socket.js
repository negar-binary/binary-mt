/*
 * It provides a abstraction layer over native javascript Websocket.
 *
 * Provide additional functionality like if connection is close, open
 * it again and process the buffered requests
 *
 *
 * Usage:
 *
 * `BinarySocket.init()` to initiate the connection
 * `BinarySocket.send({contracts_for : 1})` to send message to server
 */
function BinarySocketClass() {
    'use strict';

    var binarySocket,
        bufferedSends = [],
        manualClosed = false,
        events = {},
        authorized = false,
        timeouts = {},
        req_number = 0,
        wrongAppId = 0,
        socketUrl = getSocketURL() + '?app_id=' + getAppId() + (page.language() ? '&l=' + page.language() : '');

    var clearTimeouts = function(){
        for(var k in timeouts){
            if(timeouts.hasOwnProperty(k)){
                clearTimeout(timeouts[k]);
                delete timeouts[k];
            }
        }
    };

    var isReady = function () {
        return binarySocket && binarySocket.readyState === 1;
    };

    var isClose = function () {
        return !binarySocket || binarySocket.readyState === 2 || binarySocket.readyState === 3;
    };

    var sendBufferedSends = function () {
        while (bufferedSends.length > 0) {
            binarySocket.send(JSON.stringify(bufferedSends.shift()));
        }
    };

    var send = function(data) {
        if (isClose()) {
            bufferedSends.push(data);
            init(1);
        } else if (isReady()) {
            if(!data.hasOwnProperty('passthrough') && !data.hasOwnProperty('verify_email')){
                data.passthrough = {};
            }
            // temporary check
            if((data.contracts_for || data.proposal) && !data.passthrough.hasOwnProperty('dispatch_to')){
                data.passthrough.req_number = ++req_number;
                timeouts[req_number] = setTimeout(function(){
                    if(typeof reloadPage === 'function' && data.contracts_for){
                        alert("The server didn't respond to the request:\n\n"+JSON.stringify(data)+"\n\n");
                        reloadPage();
                    }
                    else{
                        $('.price_container').hide();
                    }
                }, 60*1000);
            }

            binarySocket.send(JSON.stringify(data));
        } else {
            bufferedSends.push(data);
        }
    };

    var init = function (es) {
        if (wrongAppId === getAppId()) {
            return;
        }
        if (!es){
            events = {};
        }
        if (typeof es === 'object') {
            bufferedSends = [];
            manualClosed = false;
            events = es;
            clearTimeouts();
        }

        if(isClose()){
            binarySocket = new WebSocket(socketUrl);
        }

        binarySocket.onopen = function () {
            var apiToken = CommonData.getLoginToken();
            if (apiToken && !authorized && localStorage.getItem('client.tokens')) {
                binarySocket.send(JSON.stringify({authorize: apiToken}));
            } else {
                sendBufferedSends();
            }

            if (typeof events.onopen === 'function') {
                events.onopen();
            }

            if (isReady()) {
                if (!Login.is_login_pages()) page.header.validate_cookies();
                if (!clock_started) page.header.start_clock_ws();
            }
        };

        binarySocket.onmessage = function(msg) {
            var response = JSON.parse(msg.data);
            if (response) {
                if(response.hasOwnProperty('echo_req') && response.echo_req !== null && response.echo_req.hasOwnProperty('passthrough')) {
                    var passthrough = response.echo_req.passthrough;
                    if(passthrough.hasOwnProperty('req_number')) {
                        clearInterval(timeouts[response.echo_req.passthrough.req_number]);
                        delete timeouts[response.echo_req.passthrough.req_number];
                    }
                }
                var type = response.msg_type;
                if (type === 'authorize') {
                    if(response.hasOwnProperty('error')) {
                        if(response.error.code === 'SelfExclusion') {
                            alert(response.error.message);
                        }
                        page.client.send_logout_request();
                    } else if (response.authorize.loginid !== page.client.loginid) {
                        page.client.send_logout_request(true);
                    } else {
                        authorized = true;
                        if(typeof events.onauth === 'function'){
                            events.onauth();
                        }
                        if(!Login.is_login_pages()) {
                            page.client.response_authorize(response);
                            send({balance:1, subscribe: 1});
                            send({get_settings: 1});
                            if(!page.client.is_virtual()) {
                                send({get_self_exclusion: 1});
                            }
                        }
                        sendBufferedSends();
                    }
                } else if (type === 'balance') {
                    ViewBalanceUI.updateBalances(response);
                } else if (type === 'time') {
                    page.header.time_counter(response);
                } else if (type === 'logout') {
                    page.header.do_logout(response);
                } else if (type === 'get_self_exclusion') {
                    SessionDurationLimit.exclusionResponseHandler(response);
                } else if (type === 'get_settings' && response.get_settings) {
                    if (!Cookies.get('residence') && response.get_settings.country_code) {
                      page.client.set_cookie('residence', response.get_settings.country_code);
                      page.client.residence = response.get_settings.country_code;
                    }
                    GTM.event_handler(response.get_settings);
                    page.client.set_storage_value('tnc_status', response.get_settings.client_tnc_status || '-');
                    page.client.check_tnc();
                } else if (type === 'website_status') {
                    if(!response.hasOwnProperty('error')) {
                        LocalStore.set('website.tnc_version', response.website_status.terms_conditions_version);
                        page.client.check_tnc();
                        if (response.website_status.hasOwnProperty('clients_country')) {
                            localStorage.setItem('clients_country', response.website_status.clients_country);
                            if (!$('body').hasClass('BlueTopBack')) {
                                checkClientsCountry();
                            }
                        }
                    }
                } else if (type === 'get_account_status' && response.get_account_status) {
                  var withdrawal_locked, i;
                  for (i = 0; i < response.get_account_status.status.length; i++) {
                    if (response.get_account_status.status[i] === 'withdrawal_locked') {
                      withdrawal_locked = 'locked';
                      break;
                    }
                  }
                  sessionStorage.setItem('withdrawal_locked', withdrawal_locked || 'unlocked');
                }
                if (response.hasOwnProperty('error')) {
                    if(response.error && response.error.code) {
                      if (response.error.code && (response.error.code === 'WrongResponse' || response.error.code === 'OutputValidationFailed')) {
                        $('#content').empty().html('<div class="container"><p class="notice-msg center-text">' + (response.error.code === 'WrongResponse' && response.error.message ? response.error.message : text.localize('Sorry, an error occurred while processing your request.') )+ '</p></div>');
                      } else if (response.error.code === 'RateLimit') {
                        $('#ratelimit-error-message')
                            .css('display', 'block')
                            .on('click', '#ratelimit-refresh-link', function () {
                                window.location.reload();
                            });
                      } else if (response.error.code === 'InvalidToken') {
                            page.client.send_logout_request();
                      } else if (response.error.code === 'InvalidAppID') {
                          wrongAppId = getAppId();
                          alert(response.error.message);
                      }
                    }
                }
                if(typeof events.onmessage === 'function'){
                    events.onmessage(msg);
                }
            }
        };

        binarySocket.onclose = function (e) {
            authorized = false;
            clearTimeouts();

            if(!manualClosed && wrongAppId !== getAppId()) {
                init(1);
            }
            if(typeof events.onclose === 'function'){
                events.onclose();
            }
        };

        binarySocket.onerror = function (error) {
            console.log('socket error', error);
        };
    };

    var close = function () {
        manualClosed = true;
        bufferedSends = [];
        events = {};
        if (binarySocket) {
            binarySocket.close();
        }
    };

    var clear = function(){
        bufferedSends = [];
        manualClosed = false;
        events = {};
    };

    return {
        init: init,
        send: send,
        close: close,
        socket: function () { return binarySocket; },
        clear: clear,
        clearTimeouts: clearTimeouts
    };

}

var BinarySocket = new BinarySocketClass();
