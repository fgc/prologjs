var S = (function () {

    var s = {};

    s.cons = function(head, tail) {
        return new s.Cons(head,tail);
    };

    s.Cons = function(head, tail) {
        this.head = head;
        this.tail = tail;
    };

    s.empty = s.cons(undefined,undefined);

    s.isNull = function(stream) {
        return stream.head == undefined;
    };
    s.Cons.prototype.isNull = function() {return s.isNull(this);};

    s.car = function(stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        return stream.head;
    };
    s.Cons.prototype.car = function() { return s.car(this);};

    function memoize(proc) {
        var already_run = false;
        var result = undefined;
        return function() {
            if(already_run) {
                return result;
            }
            already_run = true;
            result = proc();
            return result;
        };
    }

    s.cdr = function(stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        return (memoize(stream.tail))();
    };
    s.Cons.prototype.cdr = function() { return s.cdr(this);};

    s.singleton = function(value) {
        return s.cons(value, function() {
            return s.empty;
        });
    };

    s.range = function(low, high, step) {
        if(low >= high) {
            return s.empty;
        }
        return s.cons(low, function() {
            return s.range(low + step, high, step);
        });
    };

    s.forceLog = function(stream) {
	if(s.isNull(stream)) {
            return;
        }
        console.log(stream.car());
        s.forceLog(stream.cdr());
    };
    s.Cons.prototype.forceLog = function() { return s.forceLog(this);};

    s.map = function(proc, stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        return s.cons(proc(stream.car()), function() {
            return s.map(proc,stream.cdr());
        });
    };

    s.Cons.prototype.map = function(proc) {return s.map(proc,this);};

    s.filter = function(pred, stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        return pred(stream.car())
            ?s.cons(stream.car(),function() {
                return s.filter(pred,stream.cdr());
            })
            :s.filter(pred,stream.cdr());
    };
    s.Cons.prototype.filter = function(pred) { return s.filter(pred, this);};

    s.take = function(n, stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        if (n == 0) {
            return s.empty;
        }
        return s.cons(stream.car(), function() {
            return s.take(n-1, stream.cdr());
        });
    };
    s.Cons.prototype.take = function(n) { return s.take(n, this);};

    s.drop = function(n, stream) {
        for(var i = 0; i < n; i++) {
            stream = stream.cdr();
        }
        return stream;
    };

    s.Cons.prototype.drop = function(n) { return s.drop(n, this);};

    s.ordermerge = function(stream1, stream2) {
        if(s.isNull(stream1)) {
            return stream2;
        }

        if(s.isNull(stream2)) {
            return stream1;
        }

        var s1car = stream1.car();
        var s2car = stream2.car();
        if (s1car < s2car) {
            return s.cons(s1car, function() {
                return s.ordermerge(stream1.cdr(), stream2);
            });
        }

        if (s1car > s2car) {
            return s.cons(s2car, function() {
                return s.ordermerge(stream1, stream2.cdr());
            });

        }

        return s.cons(s1car, function() {
            return s.ordermerge(stream1.cdr(), stream2.cdr());
        });
    };

    s.Cons.prototype.ordermerge = function(s2) { return s.ordermerge(this, s2);};

    s.interleave = function(stream1, stream2) {
        if(s.isNull(stream1)) {
            return stream2;
        }
        return s.cons(stream1.car(), function() {
            return s.interleave(stream2, stream1.cdr());
        });
    };
    s.Cons.prototype.interleave = function(s2) { return s.interleave(this, s2);};

    s.comma = function(stream1, stream2) {
        return s.cons([stream1.car(),stream2.car()], function() {
            return s.interleave(stream2.cdr().map(function(x){
                return [stream1.car(), x];
            }),s.comma(stream1.cdr(),stream2.cdr()));
        });
    };

    s.Cons.prototype.comma = function(s2) { return s.comma(this, s2);};

    s.appendDelayed = function(stream1, dStream2) {
        if(s.isNull(stream1)) {
            return dStream2();
        }
        return s.cons(stream1.car(), function() {
            return s.appendDelayed(stream1.cdr(),dStream2);
        });
    };
    s.Cons.prototype.appendDelayed = function(s2) {
        return s.appendDelayed(this, s2);
    };

    s.interleaveDelayed = function(stream1, dStream2) {
        if(s.isNull(stream1)) {
            return dStream2();
        }
        return s.cons(stream1.car(), function() {
            return s.interleaveDelayed(dStream2(), function(){
                return stream1.cdr();
            });
        });
    };

    s.Cons.prototype.interleaveDelayed = function(s2) {
        return s.interleaveDelayed(this, s2);
    };


    function flattenStream(stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        var scar = stream.car();
        if (scar && scar.interleaveDelayed) {
            return stream.car().interleaveDelayed(function(){
                return flattenStream(stream.cdr());
            });
        }
        if (scar) {
            return s.cons(scar, function() {
                return flattenStream(stream.cdr());
            });
        }
        return flattenStream(stream.cdr());
    }

    s.flatMap = function(proc, stream) {
        if(s.isNull(stream)) {
            return s.empty;
        }
        return flattenStream(stream.map(proc));
    };

    s.Cons.prototype.flatMap = function(proc) {
        return s.flatMap(proc, this);
    };

    return s;

})();
