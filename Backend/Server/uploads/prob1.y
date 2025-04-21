%{
#include <stdio.h>
int yylex();
void yyerror(const char*);
%}

%token NUM IDENTIFIER PLUS MINUS SCOL LP RP MUL EQUAL



%%

program: statement
       | program statement
                    ;

statement: assignment SCOL ;

assignment: IDENTIFIER EQUAL expression| IDENTIFIER EQUAL expression;

expression: NUM| IDENTIFIER| MINUS expression | LP expression RP | expression PLUS term|term| expression MINUS term|
               | IDENTIFIER PLUS PLUS | IDENTIFIER MINUS MINUS | PLUS PLUS IDENTIFIER|   MINUS MINUS IDENTIFIER;
term: term MUL factor|factor;
factor:


%%
int main() {
    yyparse();
    return 0;
}

int yywrap() {
    return 1;
}

void yyerror(const char* s) {
    printf("Invalid expression: %s\n", s);
}