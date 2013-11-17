program 
    = _ prog

prog
    = (sentence _)+

sentence 
    = clause _ EOC

clause
    = head _ (":-" _ body)?

head
    = term

body
    = conjTerms

conjTerms
    = term _ ("," _ term _)*

term
    = structure
    / list
    / variable
    / atom
    / "(" _ body _ ")"

variable
    = first:(CAPITAL_LETTER/UNDERSCORE) rest:(TRAIL_STRING/SPECIALCHAR)* {
	return first + rest.join("");
    }

structure
    = functor:atom "(" first:term _ rest("," _ term _)* ")" {
    }

_
    = WHITESPACE*

EOC
    = "." (LAYOUT_CHAR)+ //end of clause

WHITESPACE
    = [ \t\n\r]

INTEGER
    = [1-9]

SMALL_LETTER
    = [a-z]

CAPITAL_LETTER
    = [A-Z]

UNDERSCORE
    = "_"

TRAIL_STRING
    = CAPITAL_LETTER
    / SMALL_LETTER
    / DIGIT
    / UNDERSCORE

UQ_CONSTANT_STRING
    = SMALL_LETTER (TRAILSTRING)*
    / (INTEGER / FLOAT)

Q_CONSTANT_STRING
    = UQ_CONSTANT_STRING / TRAIL_STRING

SPECIAL_CHAR
    = [+-*/\^[]=~:.?@#$&!;] / "[]" / "{}"