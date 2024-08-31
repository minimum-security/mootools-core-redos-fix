/*
---
name: Slick.Parser
description: Standalone CSS3 Selector parser
provides: Slick.Parser
...
*/

;(function(){

var parsed,
	separatorIndex,
	combinatorIndex,
	reversed,
	cache = {},
	reverseCache = {},
	reUnescape = /\\/g;

var extractMatchAt = function(expression, regexpPattern, index){
	var regexp = new RegExp(regexpPattern);
	var matches = expression.match(regexp);
	if (!matches) return null;

	var match = matches[index];
	var remainingExpression = expression.replace(regexp, '');
	return [match, remainingExpression];
};

var extractPseudoValue = function(expression){
	var pseudoClassValue = undefined;

	var openBraceMatches = extractMatchAt(expression, '^\\(', 0);
	if (!openBraceMatches) return [];
	var workingExpression = openBraceMatches[1];

	var quotedPseudoValueMatches = extractMatchAt(workingExpression, "^([\"'])([^\\1]*)\\1(?=\\))", 2);
	if (quotedPseudoValueMatches){
		pseudoClassValue = quotedPseudoValueMatches[0];
		workingExpression = quotedPseudoValueMatches[1];
	} else {
		var unquotedPseudoValueMatches = extractMatchAt(workingExpression, '^((?:\\([^)]+\\)|[^()]*)+)(?=\\))', 0);
		if (unquotedPseudoValueMatches){
			pseudoClassValue = unquotedPseudoValueMatches[0];
			workingExpression = unquotedPseudoValueMatches[1];
		}
	}

	if (pseudoClassValue !== undefined){
		var closingBraceMatches = extractMatchAt(workingExpression, '^\\)', 0);
		if (closingBraceMatches){
			workingExpression = closingBraceMatches[1];
		} else {
			pseudoClassValue = undefined;
		}
	}
	return [pseudoClassValue, workingExpression];
};

var safeReplacePseudo = function(expression, regexp){
	var pseudoMarkerMatches = extractMatchAt(expression, '^(:+)', 0);
	if (!pseudoMarkerMatches) return expression.replace(regexp, parser);
	var pseudoMarker = pseudoMarkerMatches[0];
	var workingExpression = pseudoMarkerMatches[1];

	var pseudoClassMatches = extractMatchAt(workingExpression,
		'^((?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])+)', 0);
	if (!pseudoClassMatches) return expression.replace(regexp, parser);
	var pseudoClass = pseudoClassMatches[0];
	workingExpression = pseudoClassMatches[1];

	var pseudoClassValue = undefined;
	var pseudoValueMatches = extractPseudoValue(workingExpression);
	if (pseudoValueMatches[0] !== undefined){
		pseudoClassValue = pseudoValueMatches[0];
		workingExpression = pseudoValueMatches[1];
	}
	pseudoClassValue = pseudoClassValue ? pseudoClassValue.replace(reUnescape, '') : null;

	parseSeparatorsAndCombinators();

	var currentParsed = parsed.expressions[separatorIndex][combinatorIndex];
	if (!currentParsed.pseudos) currentParsed.pseudos = [];
	currentParsed.pseudos.push({
		key: pseudoClass.replace(reUnescape, ''),
		value: pseudoClassValue,
		type: pseudoMarker.length == 1 ? 'class' : 'element'
	});

	return workingExpression;
};

var safeReplaceAttribute = function(expression, safeReplaceRegexp){
	var attributeKeyMatches = extractMatchAt(expression, '^\\[\\s*((?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])+)', 1);
	if (!attributeKeyMatches) return expression.replace(safeReplaceRegexp, parser);
	var attributeKey = attributeKeyMatches[0];
	var workingExpression = attributeKeyMatches[1];

	var attributeOperator;
	var attributeValue;
	var attributeOperatorMatches = extractMatchAt(workingExpression, '^\\s*([*^$!~|]?=)', 1);
	if (attributeOperatorMatches){
		attributeOperator = attributeOperatorMatches[0];
		workingExpression = attributeOperatorMatches[1];

		var attributeValueMatches = extractMatchAt(workingExpression, "^(?:\\s*(?:([\"']?)(.*?)\\1))(?=\\](?!\\]))", 2);
		if (attributeValueMatches){
			attributeValue = attributeValueMatches[0];
			workingExpression = attributeValueMatches[1];
		}
	}

	var attributeClosingBraceMatches = extractMatchAt(workingExpression, '^\\s*(\\])(?!\\])', 1);
	if (!attributeClosingBraceMatches || !attributeClosingBraceMatches[0]) return expression.replace(safeReplaceRegexp, parser);
	workingExpression = attributeClosingBraceMatches[1];

	if (attributeKey){

		parseSeparatorsAndCombinators();
		var currentParsed = parsed.expressions[separatorIndex][combinatorIndex];

		attributeKey = attributeKey.replace(reUnescape, '');
		attributeValue = (attributeValue || '').replace(reUnescape, '');

		var test, regexp;

		switch (attributeOperator){
			case '^=' : regexp = new RegExp(       '^'+ escapeRegExp(attributeValue)            ); break;
			case '$=' : regexp = new RegExp(            escapeRegExp(attributeValue) +'$'       ); break;
			case '~=' : regexp = new RegExp( '(^|\\s)'+ escapeRegExp(attributeValue) +'(\\s|$)' ); break;
			case '|=' : regexp = new RegExp(       '^'+ escapeRegExp(attributeValue) +'(-|$)'   ); break;
			case  '=' : test = function(value){
				return attributeValue == value;
			}; break;
			case '*=' : test = function(value){
				return value && value.indexOf(attributeValue) > -1;
			}; break;
			case '!=' : test = function(value){
				return attributeValue != value;
			}; break;
			default   : test = function(value){
				return !!value;
			};
		}

		if (attributeValue == '' && (/^[*$^]=$/).test(attributeOperator)) test = function(){
			return false;
		};

		if (!test) test = function(value){
			return value && regexp.test(value);
		};
		if (!currentParsed.attributes) currentParsed.attributes = [];
		currentParsed.attributes.push({
			key: attributeKey,
			operator: attributeOperator,
			value: attributeValue,
			test: test
		});
	}
	return workingExpression;
};

var safeReplace = function(expression, regexp){
	if (!expression) return;

	if (new RegExp('^(:+)').test(expression)) return safeReplacePseudo(expression, regexp);

	if (new RegExp('^(\\[)').test(expression)) return safeReplaceAttribute(expression, regexp);

	return expression.replace(regexp, parser);
};

var parse = function(expression, isReversed){
	if (expression == null) return null;
	if (expression.Slick === true) return expression;
	expression = ('' + expression).replace(/^\s+|\s+$/g, '');
	reversed = !!isReversed;
	var currentCache = (reversed) ? reverseCache : cache;
	if (currentCache[expression]) return currentCache[expression];
	parsed = {
		Slick: true,
		expressions: [],
		raw: expression,
		reverse: function(){
			return parse(this.raw, true);
		}
	};
	separatorIndex = -1;
	while (expression != (expression = safeReplace(expression, regexp)));
	parsed.length = parsed.expressions.length;
	return currentCache[parsed.raw] = (reversed) ? reverse(parsed) : parsed;
};

var reverseCombinator = function(combinator){
	if (combinator === '!') return ' ';
	else if (combinator === ' ') return '!';
	else if ((/^!/).test(combinator)) return combinator.replace(/^!/, '');
	else return '!' + combinator;
};

var reverse = function(expression){
	var expressions = expression.expressions;
	for (var i = 0; i < expressions.length; i++){
		var exp = expressions[i];
		var last = {parts: [], tag: '*', combinator: reverseCombinator(exp[0].combinator)};

		for (var j = 0; j < exp.length; j++){
			var cexp = exp[j];
			if (!cexp.reverseCombinator) cexp.reverseCombinator = ' ';
			cexp.combinator = cexp.reverseCombinator;
			delete cexp.reverseCombinator;
		}

		exp.reverse().push(last);
	}
	return expression;
};

var escapeRegExp = function(string){// Credit: XRegExp 0.6.1 (c) 2007-2008 Steven Levithan <http://stevenlevithan.com/regex/xregexp/> MIT License
	return string.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, function(match){
		return '\\' + match;
	});
};

var regexp = new RegExp(
/*
#!/usr/bin/env ruby
puts "\t\t" + DATA.read.gsub(/\(\?x\)|\s+#.*$|\s+|\\$|\\n/,'')
__END__
	"(?x)^(?:\
	  \\s* ( , ) \\s*               # Separator          \n\
	| \\s* ( <combinator>+ ) \\s*   # Combinator         \n\
	|      ( \\s+ )                 # CombinatorChildren \n\
	|      ( <unicode>+ | \\* )     # Tag                \n\
	| \\#  ( <unicode>+       )     # ID                 \n\
	| \\.  ( <unicode>+       )     # ClassName          \n\
	|                               # Attribute          \n\
	\\[  \
		\\s* (<unicode1>+)  (?:  \
			\\s* ([*^$!~|]?=)  (?:  \
				\\s* (?:\
					([\"']?)(.*?)\\9 \
				)\
			)  \
		)?  \\s*  \
	\\](?!\\]) \n\
	|   :+ ( <unicode>+ )(?:\
	\\( (?:\
		(?:([\"'])([^\\12]*)\\12)|((?:\\([^)]+\\)|[^()]*)+)\
	) \\)\
	)?\
	)"
*/
	'^(?:\\s*(,)\\s*|\\s*(<combinator>+)\\s*|(\\s+)|(<unicode>+|\\*)|\\#(<unicode>+)|\\.(<unicode>+))'
	.replace(/<combinator>/, '[' + escapeRegExp('>+~`!@$%^&={}\\;</') + ']')
	.replace(/<unicode>/g, '(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
	.replace(/<unicode1>/g, '(?:[:\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
);

function parseSeparatorsAndCombinators(
	separator,
	combinator,
	combinatorChildren
){
	if (separator || separatorIndex === -1){
		parsed.expressions[++separatorIndex] = [];
		combinatorIndex = -1;
		if (separator) return '';
	}

	if (combinator || combinatorChildren || combinatorIndex === -1){
		combinator = combinator || ' ';
		var currentSeparator = parsed.expressions[separatorIndex];
		if (reversed && currentSeparator[combinatorIndex])
			currentSeparator[combinatorIndex].reverseCombinator = reverseCombinator(combinator);
		currentSeparator[++combinatorIndex] = {combinator: combinator, tag: '*'};
	}
}

function parser(
	rawMatch,

	separator,
	combinator,
	combinatorChildren,

	tagName,
	id,
	className
){
	parseSeparatorsAndCombinators(separator, combinator, combinatorChildren);

	var currentParsed = parsed.expressions[separatorIndex][combinatorIndex];

	if (tagName){
		currentParsed.tag = tagName.replace(reUnescape, '');

	} else if (id){
		currentParsed.id = id.replace(reUnescape, '');

	} else if (className){
		className = className.replace(reUnescape, '');

		if (!currentParsed.classList) currentParsed.classList = [];
		if (!currentParsed.classes) currentParsed.classes = [];
		currentParsed.classList.push(className);
		currentParsed.classes.push({
			value: className,
			regexp: new RegExp('(^|\\s)' + escapeRegExp(className) + '(\\s|$)')
		});

	}

	return '';
};

// Slick NS

var Slick = (this.Slick || {});

Slick.parse = function(expression){
	return parse(expression);
};

Slick.escapeRegExp = escapeRegExp;

if (!this.Slick) this.Slick = Slick;

}).apply(/*<CommonJS>*/(typeof exports != 'undefined') ? exports : /*</CommonJS>*/this);
