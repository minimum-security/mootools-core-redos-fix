const vulnerableParse = require("./Source/Slick/Slick.Parser.js").Slick.parse;
const fixedParse = require("./Source/Slick/Slick.Parser.fixed.js").Slick.parse;

const vulnerableStrings = [
    ':0' + '\\[((,)'.repeat(22)
];

const fixStartTime = performance.now();
vulnerableStrings.forEach( toParse => {
    console.log(`Testing: ${toParse}`)
    const fixedResult = fixedParse(toParse);
});
const fixEndTime = performance.now();
console.log(`Fixed duration: ${fixEndTime - fixStartTime} ms`);

const vulnStartTime = performance.now();
vulnerableStrings.forEach( toParse => {
    console.log(`Testing: ${toParse}`)
    const fixedResult = vulnerableParse(toParse);
});
const vulnEndTime = performance.now();
console.log(`Vulnerable duration: ${vulnEndTime - vulnStartTime} ms`);

