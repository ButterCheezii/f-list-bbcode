# f-list-bbcode
Unobfuscated/slightly refactored versions of F-List's various BBCode parsers. Right now this repo is a work-in-progress, and doesn't contain all of them.

Create a GitHub issue if these parsers behave any differently than their obfuscated versions (these are reverse-engineered and refactored manually).

Reverse-engineering a parser consists mainly of:
- Formatting code (easy thanks to my IDE)
- Refactoring those stupid binary expressions into actual if statements (time-consuming)
- changing `1 ==` and `0 ==` to `=== true` and `=== false`, also changing `==` to `===`
- flipping pretty much every comparison operator, because everything is backwards
- renaming all the single-letter variables (the real time-consuming part, it took me a couple days to do website.js)
- changing all the var to const and let

And of course I have to do all this without changing ANY behavior in the parser.

Fun!
