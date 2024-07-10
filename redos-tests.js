const vulnerableParse = require("./Source/Slick/Slick.Parser.js").Slick.parse;
const fixedParse = require("./Source/Slick/Slick.Parser.fixed.js").Slick.parse;

var errors = [];
var currErrors = [];
var passed = 0;
var failed = 0;
var total = 0;

const assertEquals = (expected, actual, property, string) => {
    if (expected !== actual){
        currErrors.push(`Results do not match:
            String: "${string}"
            Property: ${property}
            Expected: ${expected}
            Actual: ${actual}`);
    }
};

const assertParseResultEquals = (expected, actual, string) => {
    currErrors = [];
    assertEquals(expected.length, actual.length, "length", string);
    assertEquals(expected.raw, actual.raw, "raw", string);
    assertEquals(expected.expressions?.length, actual.expressions?.length, "expression lengeth", string);
    if (expected.expressions?.length !== actual.expressions?.length) return;

    expected.expressions?.forEach((expectedExpression, index) => {
        const actualExpression = actual.expressions[index];
        expectedExpression?.forEach((expectedExpressionPart, exprIndex) => {
            const actualExpressionPart = actualExpression[exprIndex];
            assertEquals(expectedExpressionPart.combinator, actualExpressionPart.combinator, `expression[${exprIndex}].combinator`, string);
            assertEquals(expectedExpressionPart.tag, actualExpressionPart.tag, `expression[${exprIndex}].tag`, string);
            assertEquals(expectedExpressionPart.pseudos?.length, actualExpressionPart.pseudos?.length, `expression[${exprIndex}]pseudos.length`, string);
            if (expectedExpressionPart.pseudos?.length !== actualExpressionPart.pseudos?.length) return;
            
            expectedExpressionPart.pseudos?.forEach((expectedPseudo, pseudoIndex) => {
                const actualPseudo = actualExpressionPart.pseudos[pseudoIndex];
                assertEquals(expectedPseudo.key, actualPseudo.key, `expression[${exprIndex}].pseudo[${pseudoIndex}].key`, string);
                assertEquals(expectedPseudo.class, actualPseudo.class, `expression ${exprIndex}.pseudo[${pseudoIndex}].class`, string);
                assertEquals(expectedPseudo.value, actualPseudo.value, `expression ${exprIndex}.pseudo[${pseudoIndex}].value`, string);
            });
        });
    });
    if (currErrors.length === 0){
        passed += 1;
    } else {
        failed += 1;
    }
    total += 1;
    errors = errors.concat(currErrors);
};

const validSelectors = [
    'input:not([type="submit"])',
    'p ! div',
    'p !> div',
    '.foo !+ p',
    'p.foo ~',
    'p.foo ~ blockquote',
    'p.foo !~',
    'p.foo !~ blockquote',
    'p.foo ~~',
    'p.foo ~~ blockquote',
    'p.foo ^',
    'p.foo ^ strong',
    'p.foo !^',
    'p.foo !^ strong',
    'input:checked',
    ':enabled',
    'p:contains("find me")',
    ':not(div.foo)',
    'input:not([type="submit"])',
    ':not(ul li)',
    ':nth-child(3n + 2)',
    'p:index(2)',
    ':not(:is(.foo, .bar))',
    '::slotted(*)',
    'tabbed-custom-element::part(tab):hover:active',
    '.exciting-text::after',
    '#myId',
    '[pattern*="\\d"]',
    'a#selected',
    '[type="checkbox"]:checked:focus',
    'a#selected > .icon',
    '.box h2 + p',
    '#main, article.heading',
    ':has(+ div#topic > #reference)',
    ':has(> .icon)',
    'dt:has(+ img) ~ dd',
    ':not(:not(.foo), :not(.bar))',
    ':not(:not(:not(.bar)))',
    ':not(:not(:not(:not(.bar))))',
    '[type=\'checkbox\']:checked:focus',
    'p:contains(\'find me\')',
    ':not(p:contains(\'find me\'))',
    '.subitem:nth-of-type(even) .item:hover',
    '.toggle:checked + .item + .result',
    '.post h1 + p:first-line',
    'body > div > div:nth-child(3) > table:nth-child(3)',
    '.banner :matches(.item, .column)',
    ':matches(h1+h2, h2+h3, h3+h4, h4+h5)',
    '.icon:matches(:any-link img)',
    'img:not(:any-link *)',
    ':nth-child(odd of :not([hidden]))',
    ':matches(div, #foo, .bar)'
];

const randomStringOf = (chars, length) => {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
const randomSelectors = Array.from({length:1000},()=> randomStringOf("abc 123 ::.(())*-[]='\"!>+~^ 😀😀" , 100));

const selectorsToTest = [
    ...validSelectors,
    ...randomSelectors
];

selectorsToTest.forEach( toParse => {
    console.log(`Testing: ${toParse}`)
    const vulnerableResult = vulnerableParse(toParse);
    const fixedResult = fixedParse(toParse);
    assertParseResultEquals(vulnerableResult, fixedResult, toParse);
});

errors.forEach((error) => console.log(error));
console.log(`Total: ${total}  Passed: ${passed}  Failed: ${failed}`);