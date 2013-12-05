function analyze(exp) {
    if (exp.term == "amb") {
	return analyzeAmb(exp);
    }
    if (exp.term == "constant") {
	return analyzeConstant(exp);
    }
    console.log("Can't analyze:",exp);
    return "__error__";
}

function ambEval( exp, env, succeed, fail) {
    return (analyze(exp))(env, succeed, fail);
}

function analyzeConstant(exp) {
    return function(env, succeed, fail) {
	return succeed(exp,fail);
    };
}

function analyzeAmb(exp) {
    var cprocs = exp.choices.map(analyze);
    return function (env, succeed, fail) {
	function tryNext(choices) {
	    if (choices.length == 0) {
		return "__fail__";
	    }
	    else {
		return choices[0](env, succeed, function(){tryNext(choices.slice(1));});
	    }
	}
    return tryNext(cprocs);
    };

}