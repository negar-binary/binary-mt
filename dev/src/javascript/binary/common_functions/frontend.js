function check_login_hide_signup() {
    if (page.client.is_logged_in) {
        $('#verify-email-form').remove();
        $('.break').attr('style', 'margin-bottom:1em');
    }
}

function hide_if_logged_in() {
    if (page.client.is_logged_in) {
        $('.client_logged_out').remove();
    }
}

// use function to generate elements and append them
// e.g. element is select and element to append is option
function appendTextValueChild(element, text, value, disabled){
    var option = document.createElement("option");
    option.text = text;
    option.value = value;
    if (disabled === 'disabled') {
      option.setAttribute('disabled', 'disabled');
    }
    element.appendChild(option);
    return;
}

// append numbers to a drop down menu, eg 1-30
function dropDownNumbers(select, startNum, endNum) {
    select.appendChild(document.createElement("option"));

    for (var i = startNum; i <= endNum; i++){
        var option = document.createElement("option");
        option.text = i;
        option.value = i;
        select.appendChild(option);
    }
    return;

}

function dropDownMonths(select, startNum, endNum) {
    var months = [
        text.localize("Jan"),
        text.localize("Feb"),
        text.localize("Mar"),
        text.localize("Apr"),
        text.localize("May"),
        text.localize("Jun"),
        text.localize("Jul"),
        text.localize("Aug"),
        text.localize("Sep"),
        text.localize("Oct"),
        text.localize("Nov"),
        text.localize("Dec")
    ];
    select.appendChild(document.createElement("option"));
    for (var i = startNum; i <= endNum; i++){
        var option = document.createElement("option");
        if (i <= '9') {
            option.value = '0' + i;
        } else {
            option.value = i;
        }
        for (var j = i; j <= i; j++) {
            option.text = months[j-1];
        }
        select.appendChild(option);
    }
    return;
}

function generateBirthDate(country){
    var days    = document.getElementById('dobdd'),
        months  = document.getElementById('dobmm'),
        year    = document.getElementById('dobyy');

    if (document.getElementById('dobdd').length > 1) return;

    //days
    dropDownNumbers(days, 1, 31);
    //months
    dropDownMonths(months, 1, 12);
    var currentYear = new Date().getFullYear();
    var startYear = currentYear - 100;
    var endYear = currentYear - 17;
    //years
    dropDownNumbers(year, startYear, endYear);
    if (japanese_client()) {
      days.options[0].innerHTML = text.localize('Day');
      months.options[0].innerHTML = text.localize('Month');
      year.options[0].innerHTML = text.localize('Year');
    }
    return;
}

function isValidDate(day, month, year){
    // Assume not leap year by default (note zero index for Jan)
    var daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];

    // If evenly divisible by 4 and not evenly divisible by 100,
    // or is evenly divisible by 400, then a leap year
    if ( ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0) ) {
        daysInMonth[1] = 29;
    }
    return day <= daysInMonth[--month];
}

function handle_residence_state_ws(){
  BinarySocket.init({
    onmessage: function(msg){
      var select;
      var response = JSON.parse(msg.data);
      var type = response.msg_type;
      var country;
      var residenceDisabled = $('#residence-disabled');
      if (type === 'get_settings') {
        country = response.get_settings.country_code;
        if (country && country !== null) {
          page.client.residence = country;
          generateBirthDate(country);
          generateState();
          if (/maltainvestws/.test(window.location.pathname)) {
            var settings = response.get_settings;
            var title = document.getElementById('title'),
                fname = document.getElementById('fname'),
                lname = document.getElementById('lname'),
                dobdd = document.getElementById('dobdd'),
                dobmm = document.getElementById('dobmm'),
                dobyy = document.getElementById('dobyy');
            var inputs = document.getElementsByClassName('input-disabled');
            if (settings.salutation) {
              title.value = settings.salutation;
              fname.value = settings.first_name;
              lname.value = settings.last_name;
              var date = moment.utc(settings.date_of_birth * 1000);
              dobdd.value = date.format('DD').replace(/^0/, '');
              dobmm.value = date.format('MM');
              dobyy.value = date.format('YYYY');
              for (i = 0; i < inputs.length; i++) {
                  inputs[i].disabled = true;
              }
              document.getElementById('address1').value = settings.address_line_1;
              document.getElementById('address2').value = settings.address_line_2;
              document.getElementById('address-town').value = settings.address_city;
              window.state = settings.address_state;
              document.getElementById('address-postcode').value = settings.address_postcode;
              document.getElementById('tel').value = settings.phone;
            } else {
              for (i = 0; i < inputs.length; i++) {
                  inputs[i].disabled = false;
              }
            }
          }
          return;
        } else if (document.getElementById('move-residence-here')) {
          var residenceForm = $('#residence-form');
          $('#real-form').hide();
          residenceDisabled.insertAfter('#move-residence-here');
          $('#error-residence').insertAfter('#residence-disabled');
          residenceDisabled.removeAttr('disabled');
          residenceForm.show();
          residenceForm.submit(function(evt) {
            evt.preventDefault();
            if (Validate.fieldNotEmpty(residenceDisabled.val(), document.getElementById('error-residence'))) {
              page.client.residence = residenceDisabled.val();
              BinarySocket.send({set_settings:1, residence:page.client.residence});
            }
            return;
          });
          return;
        }
      } else if (type === 'set_settings') {
        var errorElement = document.getElementById('error-residence');
        if (response.hasOwnProperty('error')) {
          if (response.error.message) {
            errorElement.innerHTML = response.error.message;
            errorElement.setAttribute('style', 'display:block');
          }
          return;
        } else {
          errorElement.setAttribute('style', 'display:none');
          BinarySocket.send({landing_company: page.client.residence});
          return;
        }
      } else if (type === 'landing_company') {
        Cookies.set('residence', page.client.residence, {domain: '.' + document.domain.split('.').slice(-2).join('.'), path: '/'});
        if ( ((page.client.can_upgrade_gaming_to_financial(response.landing_company) && !page.client.is_virtual()) || page.client.can_upgrade_virtual_to_financial(response.landing_company) ) && !/maltainvestws/.test(window.location.href)) {
          window.location.href = page.url.url_for('new_account/maltainvestws');
          return;
        } else if (page.client.can_upgrade_virtual_to_japan(response.landing_company) && page.client.is_virtual() && !/japanws/.test(window.location.href)) {
          window.location.href = page.url.url_for('new_account/japanws');
          return;
        } else if (!$('#real-form').is(':visible')) {
          $('#residence-form').hide();
          residenceDisabled.insertAfter('#move-residence-back');
          $('#error-residence').insertAfter('#residence-disabled');
          residenceDisabled.attr('disabled', 'disabled');
          $('#real-form').show();
          generateBirthDate(country);
          generateState();
          return;
        }
      } else if (type === 'states_list') {
        select = document.getElementById('address-state');
        var states_list = response.states_list;
        for (i = 0; i < states_list.length; i++) {
            appendTextValueChild(select, states_list[i].text, states_list[i].value);
        }
        select.parentNode.parentNode.show();
        if (window.state) {
          select.value = window.state;
        }
        return;
      } else if (type === 'residence_list'){
        select = document.getElementById('residence-disabled') || document.getElementById('residence');
        var phoneElement   = document.getElementById('tel'),
            residenceValue = page.client.residence,
            residence_list = response.residence_list;
        if (residence_list.length > 0){
          for (i = 0; i < residence_list.length; i++) {
            var residence = residence_list[i];
            if (select) {
              appendTextValueChild(select, residence.text, residence.value, residence.disabled ? 'disabled' : undefined);
            }
            if (phoneElement && phoneElement.value === '' && residence.phone_idd && residenceValue === residence.value) {
              phoneElement.value = '+' + residence.phone_idd;
            }
          }
          if (residenceValue && select){
              select.value = residenceValue;
          }
          if (document.getElementById('virtual-form')) {
              BinarySocket.send({website_status:1});
          }
        }
        return;
      } else if (type === 'website_status') {
        var status  = response.website_status;
        if (status && status.clients_country) {
          var clientCountry = $('#residence option[value="' + status.clients_country + '"]');
          if (!clientCountry.attr('disabled')) {
              clientCountry.prop('selected', true);
          }
        }
        return;
      }
    }
  });
}

function generateState() {
    var state = document.getElementById('address-state');
    if (state.length !== 0) return;
    appendTextValueChild(state, Content.localize().textSelect, '');
    if (page.client.residence !== "") {
      BinarySocket.send({ states_list: page.client.residence });
    }
    return;
}

// returns true if internet explorer browser
function isIE() {
  return /(msie|trident|edge)/i.test(window.navigator.userAgent) && !window.opera;
}

// trim leading and trailing white space
function Trim(str){
  while(str.charAt(0) == (" ") ){str = str.substring(1);}
  while(str.charAt(str.length-1) ==" " ){str = str.substring(0,str.length-1);}
  return str;
}

function limitLanguage(lang) {
  if (page.language() !== lang && !Login.is_login_pages()) {
    window.location.href = page.url_for_language(lang);
  }
  if (document.getElementById('language_select')) {
    $('#language_select').remove();
    $('#gmt-clock').removeClass();
    $('#gmt-clock').addClass('gr-6 gr-12-m');
    $('#contact-us').removeClass();
    $('#contact-us').addClass('gr-6 gr-hide-m');
  }
}

function checkClientsCountry() {
  var clients_country = localStorage.getItem('clients_country');
  if (clients_country) {
    var str;
    if (clients_country === 'id') {
      limitLanguage('ID');
    } else {
      $('#language_select').show();
    }
  } else {
    BinarySocket.init();
    BinarySocket.send({"website_status" : "1"});
  }
}

function change_blog_link(lang) {
  var regex = new RegExp(lang);
  if (!regex.test($('.blog a').attr('href'))) {
    $('.blog a').attr('href', $('.blog a').attr('href') + '/' + lang + '/');
  }
}

//hide and show hedging value if trading purpose is set to hedging
function detect_hedging($purpose, $hedging) {
    $purpose.change(function(evt) {
      if ($purpose.val() === 'Hedging') {
        $hedging.removeClass('invisible');
      }
      else if ($hedging.is(":visible")) {
        $hedging.addClass('invisible');
      }
      return;
    });
}

$(function() {
    $( "#accordion" ).accordion({
      heightStyle: "content",
      collapsible: true,
      active: false
    });
});

var $buoop = {
  vs: {i:10, f:39, o:30, s:5, c:39},
  l: page.language().toLowerCase(),
  url: 'https://whatbrowser.org/'
};
function $buo_f(){
 var e = document.createElement("script");
 e.src = "//browser-update.org/update.min.js";
 document.body.appendChild(e);
}
try {
  document.addEventListener("DOMContentLoaded", $buo_f,false);
} catch(e) {
  window.attachEvent("onload", $buo_f);
}
