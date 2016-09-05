var text;
var clock_started = false;

var GTM = (function() {
    "use strict";

    var gtm_applicable = function() {
        return (!/binary\-mt/.test(window.location.href));
    };

    var gtm_data_layer_info = function(data) {
        var data_layer_info = {
            language  : page.language(),
            pageTitle : page_title(),
            pjax      : page.is_loaded_by_pjax,
            url       : document.URL,
            event     : 'page_load',
        };
        if(page.client.is_logged_in) {
            data_layer_info['visitorId'] = page.client.loginid;
        }

        $.extend(true, data_layer_info, data);

        var event = data_layer_info.event;
        delete data_layer_info['event'];

        return {
            data : data_layer_info,
            event: event,
        };
    };

    var push_data_layer = function(data) {
        if (!gtm_applicable()) return;
        if(!(/logged_inws/i).test(window.location.pathname)) {
            var info = gtm_data_layer_info(data && typeof(data) === 'object' ? data : null);
            dataLayer[0] = info.data;
            dataLayer.push(info.data);
            dataLayer.push({"event": info.event});
        }
    };

    var page_title = function() {
        var t = /^.+[:-]\s*(.+)$/.exec(document.title);
        return t && t[1] ? t[1] : document.title;
    };

    var event_handler = function(get_settings) {
        if (!gtm_applicable()) return;
        var is_login      = localStorage.getItem('GTM_login')      === '1';
        if(!is_login) {
            return;
        }

        localStorage.removeItem('GTM_login');

        var data = {
            'visitorId'   : page.client.loginid,
            'bom_country' : get_settings.country,
            'bom_email'   : get_settings.email,
            'url'         : window.location.href,
            'bom_today'   : Math.floor(Date.now() / 1000),
            'event'       : 'log_in'
        };
        if(!page.client.is_virtual()) {
            data['bom_age']       = parseInt((moment().unix() - get_settings.date_of_birth) / 31557600);
            data['bom_firstname'] = get_settings.first_name;
            data['bom_lastname']  = get_settings.last_name;
            data['bom_phone']     = get_settings.phone;
        }
        GTM.push_data_layer(data);
    };

    var set_login_flag = function() {
        if (!gtm_applicable()) return;
        localStorage.setItem('GTM_login', '1');
    };

    return {
        push_data_layer     : push_data_layer,
        event_handler       : event_handler,
        set_login_flag      : set_login_flag
    };
}());

var User = function() {
    this.email   = Cookies.get('email');
    this.loginid = Cookies.get('loginid');
    this.loginid_array = parseLoginIDList(Cookies.get('loginid_list') || '');
    this.is_logged_in = !!(
        this.loginid &&
        this.loginid_array.length > 0 &&
        localStorage.getItem('client.tokens')
    );
};

var Client = function() {
    this.loginid      = Cookies.get('loginid');
    this.residence    = Cookies.get('residence');
    this.is_logged_in = !!(this.loginid && this.loginid.length > 0 && localStorage.getItem('client.tokens'));
};

Client.prototype = {
    show_login_if_logout: function(shouldReplacePageContents) {
        if (!this.is_logged_in && shouldReplacePageContents) {
            $('#content > .container').addClass('center-text')
                .html($('<p/>', {class: 'notice-msg', html: text.localize('Please [_1] to view this page', [
                        '<a class="login_link" href="javascript:;">' + text.localize('login') + '</a>'
                    ])}));
            $('.login_link').click(function(){Login.redirect_to_login();});
        }
        return !this.is_logged_in;
    },
    is_virtual: function() {
        return this.get_storage_value('is_virtual') === '1';
    },
    get_storage_value: function(key) {
        return LocalStore.get('client.' + key) || '';
    },
    set_storage_value: function(key, value) {
        return LocalStore.set('client.' + key, value);
    },
    check_storage_values: function(origin) {
        var is_ok = true;

        if(!this.get_storage_value('is_virtual') && TUser.get().hasOwnProperty('is_virtual')) {
            this.set_storage_value('is_virtual', TUser.get().is_virtual);
        }

        // website TNC version
        if(!LocalStore.get('website.tnc_version')) {
            BinarySocket.send({'website_status': 1});
        }

        return is_ok;
    },
    response_authorize: function(response) {
        page.client.set_storage_value('session_start', parseInt(moment().valueOf() / 1000));
        TUser.set(response.authorize);
        if(!Cookies.get('email')) this.set_cookie('email', response.authorize.email);
        this.set_storage_value('is_virtual', TUser.get().is_virtual);
        this.check_storage_values();
        page.contents.activate_by_client_type();
        page.contents.topbar_message_visibility();
    },
    check_tnc: function() {
        if(!page.client.is_virtual() && sessionStorage.getItem('check_tnc') === '1') {
            var client_tnc_status   = this.get_storage_value('tnc_status'),
                website_tnc_version = LocalStore.get('website.tnc_version');
            if(client_tnc_status && website_tnc_version) {
                sessionStorage.removeItem('check_tnc');
                if(client_tnc_status !== website_tnc_version) {
                    sessionStorage.setItem('tnc_redirect', window.location.href);
                    window.location.href = page.url.url_for('user/tnc_approvalws');
                }
            }
        }
    },
    clear_storage_values: function() {
        var that  = this;
        var items = ['is_virtual', 'tnc_status', 'session_duration_limit', 'session_start'];
        items.forEach(function(item) {
            that.set_storage_value(item, '');
        });
        localStorage.removeItem('website.tnc_version');
    },
    update_storage_values: function() {
        this.clear_storage_values();
        this.check_storage_values();
    },
    send_logout_request: function(showLoginPage) {
        if(showLoginPage) {
            sessionStorage.setItem('showLoginPage', 1);
        }
        BinarySocket.send({'logout': '1'});
    },
    get_token: function(loginid) {
        var token,
            tokens = page.client.get_storage_value('tokens');
        if(loginid && tokens) {
            tokensObj = JSON.parse(tokens);
            if(tokensObj.hasOwnProperty(loginid) && tokensObj[loginid]) {
                token = tokensObj[loginid];
            }
        }
        return token;
    },
    add_token: function(loginid, token) {
        if(!loginid || !token || this.get_token(loginid)) {
            return false;
        }
        var tokens = page.client.get_storage_value('tokens');
        var tokensObj = tokens && tokens.length > 0 ? JSON.parse(tokens) : {};
        tokensObj[loginid] = token;
        this.set_storage_value('tokens', JSON.stringify(tokensObj));
    },
    set_cookie: function(cookieName, Value, domain) {
        var cookie_expire = new Date();
        cookie_expire.setDate(cookie_expire.getDate() + 60);
        var cookie = new CookieStorage(cookieName, domain);
        cookie.write(Value, cookie_expire, true);
    }
};

var URL = function (url) { // jshint ignore:line
    this.is_valid = true;
    this.history_supported = window.history && window.history.pushState;
    if(typeof url !== 'undefined') {
        this.location = $('<a>', { href: decodeURIComponent(url) } )[0];
    } else {
        this.location = window.location;
    }
};

URL.prototype = {
    url_for: function(path, params) {
        if(!path) {
            path = '';
        }
        else if (path.length > 0 && path[0] === '/') {
            path = path.substr(1);
        }
        var lang = page.language().toLowerCase(),
            url  = window.location.href;
        return url.substring(0, url.indexOf('/' + lang + '/') + lang.length + 2) + (path || 'home') + '.html' + (params ? '?' + params : '');
    },
    url_for_static: function(path) {
        if(!path) {
            path = '';
        }
        else if (path.length > 0 && path[0] === '/') {
            path = path.substr(1);
        }

        var staticHost = window.staticHost;
        if(!staticHost || staticHost.length === 0) {
            staticHost = $('script[src*="binary.min.js"],script[src*="binary.js"]').attr('src');

            if(staticHost && staticHost.length > 0) {
                staticHost = staticHost.substr(0, staticHost.indexOf('/js/') + 1);
            }
            else {
                staticHost = 'https://mt.binary.com/';
            }

            window.staticHost = staticHost;
        }

        return staticHost + path;
    },
    reset: function() {
        this.location = window.location;
        this._param_hash = undefined;
        this.is_valid = true;
        $(this).trigger("change", [ this ]);
    },
    param: function(name) {
        var param_hash= this.params_hash();
        return param_hash[name];
    },
    path_matches: function(url) {
        //pathname is /d/page.cgi. Eliminate /d/ and /c/ from both urls.
        var this_pathname = this.location.pathname.replace(/\/[d|c]\//g, '');
        var url_pathname = url.location.pathname.replace(/\/[d|c]\//g, '');
        return (this_pathname == url_pathname || '/' + this_pathname == url_pathname);
    },
    is_in: function(url) {
        if(this.path_matches(url)) {
            var this_params = this.params();
            var param_count = this_params.length;
            var match_count = 0;
            while(param_count--) {
                if(url.param(this_params[param_count][0]) == this_params[param_count][1]) {
                    match_count++;
                }
            }
            if(match_count == this_params.length) {
                return true;
            }
        }

        return false;
    },
    params_hash: function() {
        if(!this._param_hash) {
            this._param_hash = {};
            var params = this.params();
            var param = params.length;
            while(param--) {
                if(params[param][0]) {
                    this._param_hash[params[param][0]] = params[param][1];
                }
            }
        }
        return this._param_hash;
    },
    params: function() {
        var params = [];
        var parsed = this.location.search.substr(1).split('&');
        var p_l = parsed.length;
        while(p_l--) {
            var param = parsed[p_l].split('=');
            params.push(param);
        }
        return params;
    },
    default_redirect_url: function() {
        return 'user/settings/metatrader';
    },
};

var Menu = function(url) {
    this.page_url = url;
    var that = this;
    $(this.page_url).on('change', function() { that.activate(); });
};

Menu.prototype = {
    on_unload: function() {
        this.reset();
    },
    activate: function() {
        if (page.client.is_logged_in) {
            this.show_main_menu();
        }
    },
    show_main_menu: function() {
        $("#main-menu > div").removeClass('hidden');
        this.activate_main_menu();
    },
    activate_main_menu: function() {
        //First unset everything.
        $("#main-menu li.item").removeClass('active');
        $("#main-menu li.item").removeClass('hover');

        var active = this.active_main_menu();

        if(active.item) {
            active.item.addClass('active');
            active.item.addClass('hover');
        }

        this.on_mouse_hover(active.item);
    },
    reset: function() {
        $("#main-menu .item").unbind();
        $("#main-menu").unbind();
    },
    on_mouse_hover: function(active_item) {
        $("#main-menu .item").on( 'mouseenter', function() {
            $("#main-menu li.item").removeClass('hover');
            $(this).addClass('hover');
        });

        $("#main-menu").on('mouseleave', function() {
            $("#main-menu li.item").removeClass('hover');
            if(active_item)
                active_item.addClass('hover');
        });
    },
    active_main_menu: function() {
        var page_url = this.page_url;
        var item;

        //Is something selected in main items list
        $("#main-menu .items a").each(function () {
            var url = new URL($(this).attr('href'));
            if(url.is_in(page_url)) {
                item = $(this).closest('.item');
            }
        });

        return { item: item };
    }
};

var Header = function(params) {
    this.user = params['user'];
    this.client = params['client'];
    this.menu = new Menu(params['url']);
};

Header.prototype = {
    on_load: function() {
        this.show_or_hide_login_form();
        this.register_dynamic_links();
        this.logout_handler();
        checkClientsCountry();
    },
    on_unload: function() {
        this.menu.reset();
    },
    show_or_hide_login_form: function() {
        if (!this.user.is_logged_in || !this.client.is_logged_in) return;
        var $login_options = $('#client_loginid');
        var loginid_array = this.user.loginid_array;
        $login_options.html('');

        for (var i=0; i < loginid_array.length; i++) {
            var login = loginid_array[i];
            if (login.disabled) continue;

            var curr_id = login.id;
            var type = 'Virtual';
            if (login.real) {
                if (login.financial)          type = 'Investment';
                else if (login.non_financial) type = 'Gaming';
                else                          type = 'Real';
            }

            $login_options.append($('<option/>', {
                value: curr_id,
                selected: curr_id == this.client.loginid,
                text: template('[_1] Account ([_2])', [type, curr_id]),
            }));
        }
    },
    register_dynamic_links: function() {
        var logged_in_url = this.client.is_logged_in ?
            page.url.url_for('user/settings/metatrader') :
            page.url.url_for('');

        $('#logo').attr('href', logged_in_url).on('click', function(event) {
            event.preventDefault();
            load_with_pjax(logged_in_url);
        }).addClass('unbind_later');
    },
    start_clock_ws: function() {
        function getTime() {
            clock_started = true;
            BinarySocket.send({'time': 1,'passthrough': {'client_time': moment().valueOf()}});
        }
        this.run = function() {
            setInterval(getTime, 30000);
        };

        this.run();
        getTime();
        return;
    },
    time_counter : function(response) {
        if (isNaN(response.echo_req.passthrough.client_time) || response.error) {
            page.header.start_clock_ws();
            return;
        }
        clearTimeout(window.HeaderTimeUpdateTimeOutRef);
        var that = this;
        var clock = $('#gmt-clock');
        var start_timestamp = response.time;
        var pass = response.echo_req.passthrough.client_time;

        that.client_time_at_response = moment().valueOf();
        that.server_time_at_response = ((start_timestamp * 1000) + (that.client_time_at_response - pass));
        var update_time = function() {
            window.time = moment(that.server_time_at_response + moment().valueOf() - that.client_time_at_response).utc();
            var timeStr = window.time.format("YYYY-MM-DD HH:mm") + ' GMT';

            clock.html(timeStr);
            showLocalTimeOnHover('#gmt-clock');
            window.HeaderTimeUpdateTimeOutRef = setTimeout(update_time, 1000);
        };
        update_time();
    },
    logout_handler : function(){
        $('a.logout').unbind('click').click(function(){
            page.client.send_logout_request();
        });
    },
    validate_cookies: function() {
        var loginid_list = Cookies.get('loginid_list');
        var loginid      = Cookies.get('loginid');
        if (!loginid || !loginid_list) return;

        var accIds = loginid_list.split('+');
        var valid_loginids = new RegExp('^(' + page.settings.get('valid_loginids') + ')[0-9]+$', 'i');

        function is_loginid_valid(login_id) {
            return login_id ?
                valid_loginids.test(login_id) :
                true;
        }

        if (!is_loginid_valid(loginid)) {
            page.client.send_logout_request();
        }

        accIds.forEach(function(acc_id) {
            if (!is_loginid_valid(acc_id.split(":")[0])) {
                page.client.send_logout_request();
            }
        });
    },
    do_logout: function(response) {
        if (response.logout !== 1) return;
        page.client.clear_storage_values();
        LocalStore.remove('client.tokens');
        var cookies = ['login', 'loginid', 'loginid_list', 'email', 'settings', 'residence'];
        var domains = [
            '.' + document.domain.split('.').slice(-2).join('.'),
            '.' + document.domain,
        ];

        var parent_path = window.location.pathname.split('/', 2)[1];
        if (parent_path !== '') {
            parent_path = '/' + parent_path;
        }

        cookies.forEach(function(c) {
            var regex = new RegExp(c);
            Cookies.remove(c, {path: '/', domain: domains[0]});
            Cookies.remove(c, {path: '/', domain: domains[1]});
            Cookies.remove(c);
            if (regex.test(document.cookie) && parent_path) {
                Cookies.remove(c, {path: parent_path, domain: domains[0]});
                Cookies.remove(c, {path: parent_path, domain: domains[1]});
                Cookies.remove(c, {path: parent_path});
            }
        });
        page.reload();
    },
};

var Contents = function(client, user) {
    this.client = client;
    this.user = user;
};

Contents.prototype = {
    on_load: function() {
        this.activate_by_client_type();
        this.update_content_class();
    },
    on_unload: function() {
        if ($('.unbind_later').length > 0) {
            $('.unbind_later').off();
        }
    },
    activate_by_client_type: function() {
        $('.by_client_type').addClass('invisible');
        if(this.client.is_logged_in) {
            if(page.client.get_storage_value('is_virtual').length === 0) {
                return;
            }
            if(!page.client.is_virtual()) {
                $('.by_client_type.client_real').removeClass('invisible');
                $('.by_client_type.client_real').show();

                $('#topbar').addClass('primary-color-dark');
                $('#topbar').removeClass('secondary-bg-color');
            } else {
                $('.by_client_type.client_virtual').removeClass('invisible');
                $('.by_client_type.client_virtual').show();

                $('#topbar').addClass('secondary-bg-color');
                $('#topbar').removeClass('primary-color-dark');
            }
        } else {
            $('#btn_login').unbind('click').click(function(e){e.preventDefault(); Login.redirect_to_login();});

            $('.by_client_type.client_logged_out').removeClass('invisible');
            $('.by_client_type.client_logged_out').show();

            $('#topbar').removeClass('secondary-bg-color');
            $('#topbar').addClass('primary-color-dark');
        }
    },
    update_content_class: function() {
        //This is required for our css to work.
        $('#content').removeClass();
        $('#content').addClass($('#content_class').html());
    },
    topbar_message_visibility: function() {
        if(this.client.is_logged_in) {
            if(page.client.get_storage_value('is_virtual').length === 0) {
                return;
            }

            if (page.client.is_virtual()) {
                $('.upgrademessage').removeClass('invisible');
            }
        }
    },
};

var Page = function(config) {
    this.is_loaded_by_pjax = false;
    config = typeof config !== 'undefined' ? config : {};
    this.user = new User();
    this.client = new Client();
    this.url = new URL();
    this.settings = new InScriptStore(config['settings']);
    this.header = new Header({ user: this.user, client: this.client, url: this.url});
    this.contents = new Contents(this.client, this.user);
    this._lang = null;
    onLoad.queue(GTM.push_data_layer);
};

Page.prototype = {
    all_languages: function() {
        return ['EN', 'AR', 'DE', 'ES', 'FR', 'ID', 'IT', 'PL', 'PT', 'RU', 'VI', 'ZH_CN', 'ZH_TW'];
    },
    language_from_url: function() {
        var regex = new RegExp('^(' + this.all_languages().join('|') + ')$', 'i');
        var langs = window.location.href.split('/').slice(3);
        for (var i = 0; i < langs.length; i++) {
            var lang = langs[i];
            if (regex.test(lang)) return lang.toUpperCase();
        }
        return '';
    },
    language: function() {
        var lang = this._lang;
        if (!lang) {
            lang = (this.language_from_url() || Cookies.get('language') || 'EN').toUpperCase();
            this._lang = lang;
        }
        return lang;
    },
    on_load: function() {
        this.url.reset();
        this.localize_for(this.language());
        this.header.on_load();
        this.on_change_language();
        this.on_change_loginid();
        this.contents.on_load();
        if (CommonData.getLoginToken()) {
            ViewBalance.init();
        }
        if(!Cookies.get('language')) {
            var cookie = new CookieStorage('language');
            cookie.write(this.language());
        }
        if(sessionStorage.getItem('showLoginPage')) {
            sessionStorage.removeItem('showLoginPage');
            Login.redirect_to_login();
        }
    },
    on_unload: function() {
        this.header.on_unload();
        this.contents.on_unload();
    },
    on_change_language: function() {
        var that = this;
        $('#language_select').on('change', 'select', function() {
            var language = $(this).find('option:selected').attr('class');
            var cookie = new CookieStorage('language');
            cookie.write(language);
            document.location = that.url_for_language(language);
        });
    },
    on_change_loginid: function() {
        var that = this;
        $('#client_loginid').on('change', function() {
            $(this).attr('disabled','disabled');
            that.switch_loginid($(this).val());
        });
    },
    switch_loginid: function(loginid) {
        if(!loginid || loginid.length === 0) {
            return;
        }
        var token = page.client.get_token(loginid);
        if(!token || token.length === 0) {
            page.client.send_logout_request(true);
            return;
        }

        // cleaning the previous values
        page.client.clear_storage_values();
        // set cookies: loginid, login
        page.client.set_cookie('loginid', loginid);
        page.client.set_cookie('login'  , token);
        // set local storage
        GTM.set_login_flag();
        localStorage.setItem('active_loginid', loginid);
        $('#client_loginid').removeAttr('disabled');
        page.reload();
    },
    localize_for: function(language) {
        text = texts[language];
        moment.locale(language.toLowerCase());
    },
    url_for_language: function(lang) {
        lang = lang.trim();
        SessionStore.set('selected.language', lang.toUpperCase());
        return window.location.href.replace(new RegExp('\/' + page.language() + '\/', 'i'), '/' + lang.toLowerCase() + '/');
    },
    reload: function(forcedReload) {
        window.location.reload(forcedReload ? true : false);
    },
    check_new_release: function() { // calling this method is handled by GTM tags
        var last_reload = localStorage.getItem('new_release_reload_time');
        if(last_reload && last_reload * 1 + 10 * 60 * 1000 > moment().valueOf()) return; // prevent reload in less than 10 minutes
        var currect_hash = $('script[src*="binary.min.js"],script[src*="binary.js"]').attr('src').split('?')[1];
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (xhttp.readyState == 4 && xhttp.status == 200) {
                var latest_hash = xhttp.responseText;
                if(latest_hash && latest_hash !== currect_hash) {
                    localStorage.setItem('new_release_reload_time', moment().valueOf());
                    page.reload(true);
                }
            }
        };
        xhttp.open('GET', page.url.url_for_static() + 'version?' + Math.random().toString(36).slice(2), true);
        xhttp.send();
    },
};
