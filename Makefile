parser: prolog_parse.pegjs
	pegjs -e "var parser" --allowed-start-rules "program, query" prolog_parse.pegjs
