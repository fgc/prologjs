{
    var procs = {};
    procs["log"] = log;
    procs["unify"] = unify_bif;
    procs["write"] = write_bif;
}

program = _ first:assertion rest:(assertion)* _ {
    return [first].concat(rest);
}


assertion
    =
    a:(rule / term) _ "." {
        return a;
    }

rule
    = head:term _ ":-" _ body:termList {
        return {"term": "rule",
                "head": head,
                "body": body};
    }

term
    = ","* _ b:bifcall {return b;}
    / ","* _ s:structure {return s;}
    / ","* _ l:list {return l;}
    / ","* _ c:constant {return {"term":"constant", "value":c};}
    / ","* _ v:variable {return {"term":"variable", "name":v};}

bifcall
    = _ proc:bif _ "(" _ subterms:termList _ ")" {
        return {"term":"bif", "proc":procs[proc], "args":subterms};
    }

bif
    = "log"
    / "unify"
    / "write"

structure
    = _ functor:constant _ "(" _ subterms:termList _ ")" {
        return {"term":"structure", "functor":functor, "arity": subterms.length, "subterms":subterms};
    }

termList
    = first:term rest:(term)* {
        return [first].concat(rest);
    }

elem
   = ","* _ c:constant {return {"term":"constant", "value":c};}
    / ","* _ v:variable {return {"term":"variable", "name":v};}     

tail = "|" _ v:variable {return {"term":"variable", "name":v};}
list
    = _ "[]" {return {"term":"cons", "car":"nil"};}

    / _ "[" _ head:elem _ rest:(elem)* _ tail:(tail)?"]" {
        function consify(elems,tail) {
            console.log("consify", elems, tail);
            if (elems.length == 0) {
                return tail;
            }
            return {"term": "cons",
                    "car": elems[0],
                    "cdr": consify(elems.slice(1),tail)
                   };
        }
        
        return consify([head].concat(rest), tail);
    }

constant
    = smallConstant / str:string { return str;}

smallConstant
    = first:lowerCaseLetter rest:(atomchar)* {
        return first + rest.join("");
    }

variable
    = first:upperCaseLetter rest:(atomchar)* {
        return first + rest.join("");
    }

string
    = '"' '"' _ {return "";}
    / "'" "'" _ {return "";}
    / "'" chars:(sqchar)+ "'" _ {return chars.join("");}
    / '"' chars:(dqchar)+ '"' _ {return chars.join("");}

lowerCaseLetter
    = [a-z]

upperCaseLetter
    = [A-Z] / "_"


dqchar
    // "any-Unicode-character-except-"-or-\-or-control-character"
    = [^"\\\0-\x1F\x7f]
    / '\\"'  { return '"';  }
    / ctrlchar

sqchar
    // "any-Unicode-character-except-"-or-\-or-control-character"
    = [^'\\\0-\x1F\x7f]
    / "\\'"  { return "'";  }
    / ctrlchar

atomchar
    = [^\|\[\]\.,()'"\\\0-\x1F\x7f]

ctrlchar
     = "\\\\" { return "\\"; }
     / "\\/"  { return "/";  }
     / "\\b"  { return "\b"; }
     / "\\f"  { return "\f"; }
     / "\\n"  { return "\n"; }
     / "\\r"  { return "\r"; }
     / "\\t"  { return "\t"; }

whitespace =
    [ \t\n\r]

_ = whitespace*

