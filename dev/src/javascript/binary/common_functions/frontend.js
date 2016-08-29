function check_login_hide_signup() {
    if (page.client.is_logged_in) {
        $('#verify-email-form').remove();
        $('.break').attr('style', 'margin-bottom:1em');
    }
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

function addComma(num){
    num = (num || 0) * 1;
    return num.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
