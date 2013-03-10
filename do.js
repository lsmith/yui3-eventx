YUI.add('eventx-do', function (Y) {
/**
Adds Y.Do for AOP wrapping object methods.

@module eventx
@submodule eventx-do
@for YUI
**/
var isObject = Y.Lang.isObject,
    Do;

Do = Y.Do = new Y.EventTarget({
    subscribe: function (target, args, phase) {
        var aop    = Do._yuievt.aop,
            host   = args[1],
            name   = args[2],
            method = host[name],
            key    = Y.stamp(host) + ':' + name;

        if (!aop[key]) {
            aop[key] = method;

            host[name] = function () {
                return Do.fire(key, host, arguments)
                         .currentRetVal;
            };
        }

        // Realign the args for Subscription's signature assumption
        args.splice(0, 3, method, key, args[3] || host);

        this.registerSub(new this.Subscription(Do, args, phase));
    },

    fire: function (target, args) {
        var config = Do._yuievt,
            aop    = config.aop,
            key    = args[0],
            host   = args[1],
            methodArgs = args[2],
            subs   = config.subs[key],
            ret, i, len, prevented;

        if (subs && subs.before) {
            for (i = 0, len = subs.before.length; i < len; ++i) {
                ret = subs.before[i].notify(methodArgs);

                if (ret && isObject(ret)) {
                    if (ret instanceof Halt) {
                        Do.currentRetVal = ret.retVal;
                        return;
                    } else if (ret instanceof AlterArgs) {
                        methodArgs = ret.newArgs;
                    } else if (ret instanceof Prevent) {
                        prevented = true;
                        break;
                    }
                }
            }
        }

        // Execute the original method unless prevented
        Do.currentRetVal = Do.originalRetVal = prevented ? undefined :
            aop[key].apply(host, methodArgs);

        if (subs && subs.after) {
            for (i = 0, len = subs.after.length; i < len; ++i) {
                ret = subs.after[i].notify(methodArgs);

                if (ret && isObject(ret)) {
                    if (ret instanceof Halt) {
                        Do.currentRetVal = ret.retVal;
                        return;
                    } else if (ret instanceof AlterReturn) {
                        Do.currentRetVal = ret.newRetVal;
                    }
                }
            }
        }
    }
});

Y.Do._yuievt.aop = {};

Y.Do.before = Y.Do.on;

}, '', { requires: ['eventx'] });
