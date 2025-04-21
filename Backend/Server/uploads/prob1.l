%{
#include<stdio.h>
#include<stdlib.h>
#include "y.tab.h"
%}

letter [a-zA-Z]
digit [0-9]
%%
{digit}+ {printf("%s",yytext);return NUM;}
"-" {printf("%s",yytext);return MINUS;}
"+" {printf("%s",yytext);return PLUS;}
";"    {printf("%s",yytext);return SCOL;}
"("    {printf("%s",yytext);return LP;}
")"    {printf("%s",yytext);return RP;}
"*"    {printf("%s",yytext);return MUL;}
"="    {printf("%s",yytext);return EQUAL;}



[ \t] ;  

"$"  {return 0;}
.  {return yytext[0];}

%%
