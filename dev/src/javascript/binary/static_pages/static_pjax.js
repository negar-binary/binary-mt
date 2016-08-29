pjax_config_page('/\?.+|/home', function() {
    return {
        onLoad: function() {
            if(/^(\/|\/home)$/i.test(window.location.pathname)) {
                page.client.redirect_if_login();
            }
            check_login_hide_signup();
            submit_email();
        }
    };
});
