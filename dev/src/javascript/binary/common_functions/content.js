var Content = (function() {
    'use strict';

    var localize = {};

    var populate = function() {
        localize = {
            textMessageRequired: text.localize('This field is required.'),
            textMessageCountLimit: text.localize('You should enter between [_1] characters.'), // [_1] should be replaced by a range. sample: (6-20)
            textMessageJustAllowed: text.localize('Only [_1] are allowed.'), // [_1] should be replaced by values including: letters, numbers, space, period, ...
            textMessageValid: text.localize('Please submit a valid [_1].'), // [_1] should be replaced by values such as email address
            textMessageMinRequired: text.localize('Minimum of [_1] characters required.'),
            textMessagePasswordScore: text.localize( 'Password score is: [_1]. Passing score is: 20.'),
            textShouldNotLessThan: text.localize('Please enter a number greater or equal to [_1].'),
            textNumberLimit: text.localize('Please enter a number between [_1].')       // [_1] should be a range
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
