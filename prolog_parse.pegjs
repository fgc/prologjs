l0 = first:assertion rest:(assertion)* _ {
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
    = ","* _ s:structure {return s;}
    / ","* _ l:list {return l;}
    / ","* _ c:constant {return {"term":"constant", "value":c};}
    / ","* _ v:variable {return {"term":"variable", "name":v};}

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
    = _ "[" _ head:elem _ rest:(elem)* _ tail:(tail)?"]" {
        function consify(elems,tail) {
            console.log("consify", elems, tail);
            if (elems.length == 0 && tail == "") {
                return {"term":"cons", "car":"nil"};
            }
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
    = smallConstant / "'" str:string "'" { return str;}

smallConstant
    = first:lowerCaseLetter rest:(character)* {
        return first + rest.join("");
    }

variable
    = first:upperCaseLetter rest:(character)* {
        return first + rest.join("");
    }

string
    = str:(character)+ {
        return str.join("");
    }

lowerCaseLetter
    = [a-z]

upperCaseLetter
    = [A-Z]

character
    = lowerCaseLetter / upperCaseLetter / [ ]

whitespace =
    [ \t\n\r]

_ = whitespace*

