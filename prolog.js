/******************************/
//SICProlog implementation

function prettyFrame (frame) {
        return JSON.stringify(frame);
}

function prettyFrameStream(frameStream) {
    if (S.isNull(frameStream)) {
        return "true";
    }
    return prettyFrame(frameStream.car()) + "\n" + prettyFrameStream(frameStream.cdr());
}


function qEval(query, frameStream) {
    if (query instanceof Array) {
        return conjoin(query, frameStream);
    }
    return simpleQuery(query, frameStream);
}


function simpleQuery(queryPattern, frameStream) {
    return frameStream.flatMap(function(frame) {
        return S.appendDelayed(findAssertions(queryPattern, frame),function(){
            return applyRules(queryPattern, frame);
        });
    });
 }

function conjoin(conjuncts, frameStream) {
    if(conjuncts.length == 0) {
        return frameStream;
    }
    return conjoin(conjuncts.splice(1), qEval(conjuncts[0],frameStream));
}

function findAssertions(pattern, frame) {
    return fetchAssertions().flatMap(function(datum) {
        return checkAnAssertion(datum, pattern, frame);
    });
}

function fetchProgram(i) {//TODO organize in tables or so and use the pattern to select
    var i = i || 0;
    if (i >= window.program.length) {
        return S.empty;
    }
    return S.cons(window.program[i],function(){
        return fetchProgram(++i);
    });
}

function fetchAssertions() {
    return fetchProgram().filter(function(a) {
        return a.term != "rule";
    });
};

function fetchRules() {
    return fetchProgram().filter(function(a) {
        return a.term == "rule";
    });
};

function checkAnAssertion(assertion, queryPattern, queryFrame) {
    var matchResult = patternMatch(queryPattern, assertion, queryFrame);
    if (matchResult == "fail") {
        return S.empty;
    }
    return S.singleton(matchResult);
}

function patternMatch(pat, dat, frame) {
    if (frame == "fail") {return "fail";}
    if (pat.term == "constant"
       && dat.term == "constant"
       && pat.value == dat.value) {return frame;}
    if (pat.term == "variable") {
        return extendIfConsistent(pat, dat, frame);
    }
    if (pat.term == "structure"
        && dat.term == "structure"
        && pat.functor == dat.functor
        && pat.arity == pat.arity) {
        return pat.subterms.reduce(function(prev, cur, i) {
            return patternMatch(cur,dat.subterms[i],prev);
        }, frame);
    }
    if (pat.term == "cons"
        && dat.term == "cons") {

        if (pat.car == "nil"
            && dat.car == "nil") {
            return frame;
        }
        var carFrame = patternMatch(pat.car,
                                    dat.car,
                                    frame);
        return patternMatch(pat.cdr,
                            dat.cdr,
                            carFrame);
    }
    return "fail";
}

function extendIfConsistent(variable, dat, frame) {
    if(frame[variable.name]) {
        return patternMatch(frame[variable.name], dat, frame);
    } else {
        var newframe = JSON.parse(JSON.stringify(frame)); //UGGG
        newframe[variable.name] = dat;
        return newframe;
    }
}


/*************************************
Rules and unification
*************************************/
var ruleCounter = 0;
function newRuleApplicationId() {
    return ruleCounter++;
}

function makeNewVariable(variable, ruleApplicationId) {
    return {term:"variable",
            name: variable.name + ruleApplicationId};
}

function applyRules(pattern, frame) {
    var rules = fetchRules();
    if (!rules) {
        return S.empty;
    }
    return rules.flatMap(function(rule){
        return applyRule(rule, pattern, frame);
    });
}

function applyRule(rule, pattern, frame) {
    var cleanRule = renameVars(rule);
    var unifyResult = unifyMatch(pattern, cleanRule.head, frame);
    if (unifyResult == "fail") {
        return S.empty;
    }
    return qEval(cleanRule.body, S.singleton(unifyResult));
}

function renameVars(rule) {
    var ruleApplicationId = newRuleApplicationId();
    function treeWalk(term) {
        if (term.term == "variable") {
            return makeNewVariable(term, ruleApplicationId);
        }
        if (term.term == "atom") {
            return term;
        }
        if (term.term == "structure") {
            return {
                term: "structure",
                functor: term.functor,
                arity:  term.arity,
                subterms: term.subterms.map(function(t){return treeWalk(t);})
            };
        }
        if (term.term == "cons") {
            if (term.car=="nil") {
                return term;
            }
            return {
                term: "cons",
                car: treeWalk(term.car),
                tail: treeWalk(term.cdr)
            };
        }
	console.log("Warning: Unknown term type in renameVars:treeWalk", term, "rule:", rule);
	return term;
    }
    return {
        term: "rule",
        head: treeWalk(rule.head),
        body: rule.body.map(function(t) {return treeWalk(t);})
    };
}

function unifyMatch(pattern1, pattern2, frame) {
    if (frame == "fail") {
        return "fail";
    }
    if (pattern1.term == "constant"
       && pattern2.term == "constant"
       && pattern1.value == pattern2.value) {
        return frame;
    }
    if (pattern1.term == "variable") {
        return extendIfPossible(pattern1, pattern2, frame);
    }
    if (pattern2.term == "variable") {
        return extendIfPossible(pattern2, pattern1, frame);
    }
    if (pattern1.term == "structure"
        && pattern2.term == "structure"
        && pattern1.functor == pattern2.functor
        && pattern1.arity == pattern2.arity) {
        return pattern1.subterms.reduce(function(prev, cur, i) {
            return unifyMatch(cur,pattern2.subterms[i],prev);
        }, frame);
    }
    if (pattern1.term == "cons"
        && pattern2.term == "cons") {
        console.log("unifying", pattern1, pattern2);
        if (pattern1.car == "nil" && pattern2.car == "nil") {
            return frame;
        }
        var carFrame = unifyMatch(pattern1.car, pattern2.car, frame);
        return unifyMatch(pattern1.cdr, pattern2.cdr, carFrame);
    }

    return "fail";
}


function extendIfPossible(variable, value, frame) {
    if(frame[variable.name]) {
        return unifyMatch(frame[variable.name], value, frame);
    }
    if (value.term && value.term == "variable") {
        if (frame[value.name]) {
            return unifyMatch(variable, frame[value.name], frame);
        }
    }
    if (dependsOn(value, variable, frame)) {
        return "fail";
    }

    var newframe = JSON.parse(JSON.stringify(frame)); //UGGG
    newframe[variable.name] = value;
    return newframe;
}

function dependsOn(term, variable, frame) {
    function treeWalk(t) {
        if (t.term == "variable") { //we found the variable in our dependencies
            if (t.name == variable.name) {
                return true;
            }
            if(frame[t.name]) { //this variable might refer to another that is the one
                return treeWalk(frame[t.name]);
            }
            return false; //we didn't find the variable at all
        }
        if (term.term == "structure") {
            return term.subterms.reduce(function(found,st) {
                return found || treeWalk(st);}, false);
        }
        if (term.term == "cons") {
            if(term.car == "nil") {
                return false;
            }
            return treeWalk(term.car) || treeWalk(term.cdr);
        }
        return false;
    }
    return treeWalk(term);
}
