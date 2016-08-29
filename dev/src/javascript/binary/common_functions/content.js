var Content = (function() {
    'use strict';

    var localize = {};

    var populate = function() {
        localize = {

        };
    };

    var errorMessage = function(messageType, param) {
        var msg = "",
            separator = ', ';
        switch (messageType) {
            case 'req':
                msg = localize.textMessageRequired;
                break;
            case 'reg':
                if (param)
                    msg = template(localize.textMessageJustAllowed, [param.join(separator)]);
                break;
            case 'range':
                if (param)
                    msg = template(localize.textMessageCountLimit, [param]);
                break;
            case 'valid':
                if (param)
                    msg = template(localize.textMessageValid, [param]);
                break;
            case 'min':
                if (param)
                    msg = template(localize.textMessageMinRequired, [param]);
                break;
            case 'pass':
                if (param)
                    msg = template(localize.textMessagePasswordScore, [param]);
                break;
            case 'number_not_less_than':
                msg = template(localize.textShouldNotLessThan, [param]);
                break;
            case 'number_should_between':
                msg = template(localize.textNumberLimit, [param]);
                break;
            default:
                break;
        }
        return msg;
    };

    return {
        localize: function() {
            return localize;
        },
        populate: populate,
        errorMessage: errorMessage
    };

})();
