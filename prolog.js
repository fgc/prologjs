/******************************/
//SICProlog implementation

function output(text, terminal) {
    terminal.echo(text);
}

function prettyFrames(queryVars,frameStream) {
    return frameStream.flatMap(function(frame) {
        return queryVars.reduce(function(str,v,i){
	    var sep = (i>0)?", ":"";
	    return str +
		   sep +
		   v.name +
		   " = " +
		   prettyTerm(instantiate(v,frame));
	    },"") + ";\n";
	});
}

function prettyTerm(term) {
    if (term.term == "constant") {
	return term.value;
    }
    if (term.term == "cons") {
	return prettyList(term, "[");
    }
    return JSON.stringify(term);
}

function prettyList(list, str) {
    if (list.car == "nil") {
	return str.slice(0,-2) + "]";
    }
    return prettyList(list.cdr, str + prettyTerm(list.car) + ", ");
}

function queryVars(query) {
    var varlist = [];
    function treeWalk(term) {
	if (term.term == "conj" || term.term == "disj") {
	    term.subterms.forEach(function(t){treeWalk(t);});
	    return;
	}
        if (term.term == "variable") {
            varlist.push(term);
	    return;
        }
        if (term.term == "constant") {
            return;
        }
        if (term.term == "structure") {
            term.subterms.map(function(t){treeWalk(t);});
	    return;
        }
        if (term.term == "bif") {
            term.args.forEach(function(t){treeWalk(t);});
	    return;
        }
        if (term.term == "cons") {//FIX THIS!
            if (term.car=="nil") {
                return;
            }
            treeWalk(term.car);
            treeWalk(term.cdr);
	    return;

        }
	console.log("Warning: Unknown term type in queryVars:treeWalk",
	    term,
	    "query:",
	    query);
	return;
    }
    treeWalk(query);
    return varlist;
}

function prettyFrame (frame) {
        return JSON.stringify(frame);
}

function prettyFrameStream(frameStream) {
    if (S.isNull(frameStream)) {
        return "true";
    }
    return prettyFrame(frameStream.car()) + "\n" +
	   prettyFrameStream(frameStream.cdr());
}

function instantiate(exp, frame) {
    function copy(exp) {
	if (exp.term == "variable") {
	    if (frame[exp.name] != undefined) {
		return copy(frame[exp.name]);
	    }
	    else {
		return exp;
	    }
	}
	if (exp.term == "cons" && exp.car != "nil") {
	    return {
		term: "cons",
		car: copy(exp.car),
		cdr: copy(exp.cdr)
	    };
	}
	if (exp instanceof Array) {
	    return exp.map(function(e){return copy(e);});
	}

	return exp;
    }
    return copy(exp);
}

function executeQuery(query, terminal) {
    function forcePrint(stream) {
	if(S.isNull(stream)) {
	    output("no.\n\n", terminal);
	    return;
	}
	output(stream.car(), terminal);
	forcePrint(stream.cdr(), terminal);
    }
    var frames = qEval(query,S.singleton({}));
    if (!S.isNull(frames)) {
	var vars = queryVars(query);
	if (vars.length == 0) {
	output("true.\n\n", terminal);
	} else {
        forcePrint(prettyFrames(vars, frames));
	}
    }
    else {
	output("no.\n\n",terminal);
    }
}

function qEval(query, frameStream) {
    if (query.term == "conj") {
        return conjoin(query.subterms, frameStream);
    }
    if (query.term == "disj") {
        return disjoin(query.subterms, frameStream);
    }
    if(query.term == "bif") {
	return execBif(query,frameStream);
    }
    return simpleQuery(query, frameStream);
}

function execBif(bifcall, frameStream) {
    return frameStream.flatMap(function(frame) {
	return bifcall.proc.apply(frame,
				  instantiate(bifcall.args, frame));
	});
}

function simpleQuery(queryPattern, frameStream) {
    return frameStream.flatMap(function(frame) {
        return findAssertions(queryPattern, frame)
	    .appendDelayed(function(){
		return applyRules(queryPattern, frame);
            });
    });
 }

function conjoin(conjuncts, frameStream) {
    if(conjuncts.length == 0) {
        return frameStream; //the base case for conjunction is true;
    }
    return conjoin(conjuncts.splice(1), qEval(conjuncts[0],frameStream));
}

function disjoin(disjuncts, frameStream) {
    if(disjuncts.length == 0) {
	return S.empty; //the base case for disjunction is false;
    }
    return S.interleaveDelayed(qEval(disjuncts[0], frameStream),
			       function() {return disjoin(disjuncts.splice(1), frameStream);}
			      );
}

function findAssertions(pattern, frame) {
    return fetchAssertions().flatMap(function(datum) {
        return checkAnAssertion(datum, pattern, frame);
    });
}

function fetchProgram(i) {
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
    var cleanAssertion = renameVars(assertion);
    var matchResult = unifyMatch(queryPattern, cleanAssertion, queryFrame);
    if (matchResult == "fail") {
        return S.empty;
    }
    return S.singleton(matchResult);
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
    if (rules.isNull()) {
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

function renameVars(term) {
    var ruleApplicationId = newRuleApplicationId();
    function treeWalk(term) {
	if (term.term == "rule") {
	    return {
		term: "rule",
		head: treeWalk(term.head),
		body: treeWalk(term.body)
	    };
	}
        if (term.term == "variable") {
            return makeNewVariable(term, ruleApplicationId);
        }
        if (term.term == "constant") {
            return term;
        }
	if (term.term == "conj") {
	    return {
		term: "conj",
		subterms: term.subterms.map(function(t){return treeWalk(t);})
	    };
	}
	if (term.term == "disj") {
	    return {
		term: "disj",
		subterms: term.subterms.map(function(t){return treeWalk(t);})
	    };
	}
        if (term.term == "structure") {
            return {
                term: "structure",
                functor: term.functor,
                arity:  term.arity,
                subterms: term.subterms.map(function(t){return treeWalk(t);})
            };
        }
        if (term.term == "bif") {
	    return {
		term: term.term,
		proc: term.proc,
		args: term.args.map(function(t){return treeWalk(t);})

	    };
        }
        if (term.term == "cons") {
            if (term.car=="nil") {
                return term;
            }
            return {
                term: "cons",
                car: treeWalk(term.car),
                cdr: treeWalk(term.cdr)
            };
        }
	console.log("Warning: Unknown term type in renameVars:treeWalk",
		    term,
		    "rule:",
		    rule);
	return term;
    }
    return treeWalk(term);
}

function unifyMatch(pattern1, pattern2, frame) {
    if (frame == "fail") {
        return "fail";
    }
    if (pattern1 == "nil" && pattern2 != "nil") {
	return "fail";
    }
    if (pattern2 == "nil" && pattern1 != "nil") {
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
    if (pattern1.term == "bif") {
	return unifyMatch();
    }
    if (pattern1.term == "cons"
        && pattern2.term == "cons") {
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
        if (t.term == "structure") {
            return t.subterms.reduce(function(found,st) {
                return found || treeWalk(st);}, false);
        }
        if (t.term == "cons") {
            if(t.car == "nil") {
                return false;
            }
            return treeWalk(t.car) || treeWalk(t.cdr);
        }
        return false;
    }
    return treeWalk(term);
}


 /*********************
 * BIF
 **********************/
function log(term) {
    console.log("LOG", term);
    return S.singleton(this);
}

function write_bif(/*args*/) {
    function writeTerm(term) {
	if(term.term == "constant") {
	    output(term.value, window.terminal);
	}
	else {
	    output("?\n",window.terminal);
	    console.log("Warning: we can only write out"
			+ " constants so far, you tried to write: ", term);
	}
    }
    var terms = Array.prototype.slice.call(arguments);
    terms.forEach(writeTerm);
    return S.singleton(this);
}

function unify_bif(p1, p2) {
    var match = unifyMatch(p1, p2, this);
    if (match == "fail") {
	return S.empty;
    }
    return S.singleton(match);
}

function sum_bif(variable, a, b) {
    return extendIfConsistent(variable,
	{term:"constant", value:a.value + b.value}, this);
}

function mul_bif(variable, a, b) {
    return extendIfConsistent(variable,
	{term:"constant", value:a.value * b.value}, this);
}

function not_bif(negatedQuery) {
    var tryQuery = qEval(negatedQuery,S.singleton(this));
    if (S.isNull(tryQuery)) {
	return S.singleton(this);
    }
    else {
	return S.empty;
    }
}

function gt_bif(a,b) {
    if(a.value > b.value) {
	return S.singleton(this);
    }
    else {
	return S.empty;
    }
}

function lt_bif(a,b) {
    if(a.value < b.value) {
	return S.singleton(this);
    }
    else {
	return S.empty;
    }
}

function cons_bif(variable, h, t) {
    return extendIfConsistent(variable,
	{term:"cons", car:h, cdr:t}, this);
}

function fail_bif() {
    return S.empty;
}

function true_bif() {
    return S.singleton(this);
}
