// Port test correction: &#x1F600; has 9 UTF-16 units, not 10.
// The original parser itself returns source end 35 for the fixture at index 26.
package chat {
import core.hud.components.chat.ChatArtifactToken;
import core.hud.components.chat.ChatArtifactTokenRegistry;
import core.hud.components.chat.rich.RichBitmapMarkup;
import core.hud.components.chat.rich.RichBitmapMarkupParser;
import core.hud.components.chat.rich.RichBitmapMarkupSerializer;

import flash.desktop.NativeApplication;
import flash.display.Sprite;
import flash.events.Event;
import flash.utils.getTimer;

/** Focused contract tests for the pure chat bitmap-markup parser. */
public final class RichBitmapMarkupParserContractTest extends Sprite {
    private static const DEFAULT_SIZE:Number = 13;
    private static const DEFAULT_COLOR:uint = 0xffffff;

    public function RichBitmapMarkupParserContractTest() {
        super();
        addEventListener(Event.ADDED_TO_STAGE, run);
    }

    private function run(event:Event):void {
        removeEventListener(Event.ADDED_TO_STAGE, run);
        try {
            testAstrofluxFontTags();
            testNestedFontTags();
            testSafeVisualTagsAndBreaks();
            testEntities();
            testSourceMapping();
            testCanonicalSerializer();
            testEscapedLiteralMarkup();
            testMalformedAndUnknownTags();
            testLongUnbrokenToken();
            testInjectionSafety();
            testValidationAndResultReuse();
            testArtifactTokenContract();
            testArtifactTokenProjectionAndSerialization();
            trace("RichBitmapMarkupParserContractTest PASS");
            NativeApplication.nativeApplication.exit(0);
        } catch (error:*) {
            trace("RichBitmapMarkupParserContractTest FAIL: " + error);
            NativeApplication.nativeApplication.exit(1);
        }
    }

    private function testAstrofluxFontTags():void {
        var result:RichBitmapMarkup = parse(
                "<FONT COLOR='#88ff88'>UP</FONT> " +
                "<font color=\"#112233\">low</font> " +
                "<FoNt SIZE='20' COLOR=\"ffaa44\">both</fOnT>");
        assertEquals("UP low both", result.text,
                "FONT is case-insensitive and accepts both quote styles");
        assertRange(result, 0, 2, 0x88ff88, DEFAULT_SIZE,
                "uppercase FONT color");
        assertRange(result, 2, 3, DEFAULT_COLOR, DEFAULT_SIZE,
                "closing uppercase FONT restores defaults");
        assertRange(result, 3, 6, 0x112233, DEFAULT_SIZE,
                "lowercase font color");
        assertRange(result, 7, 11, 0xffaa44, 20,
                "FONT accepts color and size together in either order");

        result = parse("<font color='#abc'>short</font>");
        assertEquals("short", result.text, "three-digit color text");
        assertRange(result, 0, result.text.length, 0xaabbcc, DEFAULT_SIZE,
                "three-digit color expands to six digits");

        result = parse("<font size='28px'>large</font>");
        assertEquals("large", result.text, "CSS-style pixel size text");
        assertRange(result, 0, result.text.length, DEFAULT_COLOR, 28,
                "optional px suffix is accepted");
    }

    private function testNestedFontTags():void {
        var result:RichBitmapMarkup = parse(
                "<font color='#ff0000' size='20'>A" +
                "<font color=\"#00ff00\">B" +
                "<font size='8'>C</font>D</font>E</font>F");
        assertEquals("ABCDEF", result.text, "nested FONT text");
        assertAt(result, 0, 0xff0000, 20, "outer font");
        assertAt(result, 1, 0x00ff00, 20,
                "inner color inherits size");
        assertAt(result, 2, 0x00ff00, 8,
                "inner size inherits color");
        assertAt(result, 3, 0x00ff00, 20,
                "closing inner size restores prior frame");
        assertAt(result, 4, 0xff0000, 20,
                "closing inner font restores outer frame");
        assertAt(result, 5, DEFAULT_COLOR, DEFAULT_SIZE,
                "closing outer font restores defaults");
    }

    private function testSafeVisualTagsAndBreaks():void {
        var result:RichBitmapMarkup = parse(
                "A<b>B<i>C</i>D</b>E<u>F<br>G<BR/>H<br />I</u>J");
        assertEquals("ABCDEF\nG\nH\nIJ", result.text,
                "b/i/u are safe no-ops and common br spellings work");
        assertAllDefault(result,
                "safe visual tags do not affect the regular-only atlas");
    }

    private function testEntities():void {
        var result:RichBitmapMarkup = parse(
                "Fish &amp; chips &#9733; &#x2605; &lt;ok&gt; " +
                "&quot;q&quot; &apos;a&apos; A&nbsp;B &bogus;");
        assertEquals("Fish & chips \u2605 \u2605 <ok> \"q\" 'a' A B &bogus;",
                result.text,
                "named, decimal, and hexadecimal entities decode safely");
        assertAllDefault(result, "entity formatting");

        var lineBreakSource:String = "A&#13;&#10;B&#13;C";
        result = parse(lineBreakSource);
        assertEquals("A\nB\nC", result.text,
                "numeric CRLF entities normalize like literal line breaks");
        assertSourceSpan(result, 1, 1, 11,
                "a CRLF entity pair is one atomic source span");
        var serialized:String = RichBitmapMarkupSerializer.serialize(result,
                DEFAULT_SIZE, DEFAULT_COLOR);
        assertEquals(result.text, parse(serialized).text,
                "entity-derived line breaks survive canonical serialization");
    }

    private function testSourceMapping():void {
        var source:String = "A<font color='#f00'>B&amp;&#x1F600;</font>C";
        var result:RichBitmapMarkup = parse(source);
        assertEquals("AB&\ud83d\ude00C", result.text,
                "source-map fixture visible text");
        assertEquals(source.length, result.sourceLength,
                "source map retains serialized length");
        assertEquals(result.text.length, result.sourceStarts.length,
                "source starts parallel visible UTF-16 text");
        assertEquals(result.text.length, result.sourceEnds.length,
                "source ends parallel visible UTF-16 text");

        var b:int = source.indexOf("B");
        var amp:int = source.indexOf("&amp;");
        var scalarEntity:int = source.indexOf("&#x1F600;");
        var c:int = source.lastIndexOf("C");
        assertSourceSpan(result, 0, 0, 1, "plain prefix");
        assertSourceSpan(result, 1, b, b + 1,
                "text after an opening tag");
        assertSourceSpan(result, 2, amp, amp + 5,
                "named entity is one atomic source span");
        assertSourceSpan(result, 3, scalarEntity, scalarEntity + "&#x1F600;".length,
                "numeric supplementary entity high surrogate");
        assertSourceSpan(result, 4, scalarEntity, scalarEntity + "&#x1F600;".length,
                "numeric supplementary entity low surrogate");
        assertSourceSpan(result, 5, c, c + 1, "plain suffix");

        assertEquals(1, result.sourceIndexAtVisibleBoundary(1, true),
                "left affinity remains before a hidden opening tag");
        assertEquals(b, result.sourceIndexAtVisibleBoundary(1, false),
                "right affinity remains inside a hidden opening tag");
        assertEquals(amp, result.sourceIndexAtVisibleBoundary(2),
                "ordinary visible boundary maps exactly");
        assertEquals(scalarEntity + "&#x1F600;".length,
                result.sourceIndexAtVisibleBoundary(5, true),
                "left affinity remains before a hidden closing tag");
        assertEquals(c, result.sourceIndexAtVisibleBoundary(5, false),
                "right affinity moves beyond a hidden closing tag");

        assertEquals(1, result.visibleIndexAtSource(
                source.indexOf("color"), false),
                "an opening-tag offset collapses to its visible boundary");
        assertEquals(2, result.visibleIndexAtSource(amp + 2, false),
                "backward mapping cannot split a named entity");
        assertEquals(3, result.visibleIndexAtSource(amp + 2, true),
                "forward mapping crosses a complete named entity");
        assertEquals(3, result.visibleIndexAtSource(
                scalarEntity + 3, false),
                "backward mapping cannot split a scalar entity");
        assertEquals(5, result.visibleIndexAtSource(
                scalarEntity + 3, true),
                "forward mapping crosses both surrogate code units");
        assertEquals(5, result.visibleIndexAtSource(
                source.indexOf("</font>") + 2, false),
                "a closing-tag offset collapses to its visible boundary");
    }

    private function testCanonicalSerializer():void {
        var markup:RichBitmapMarkup = new RichBitmapMarkup();
        markup.text = "A&<>\ud83d\ude00";
        fillStyles(markup, markup.text.length, DEFAULT_COLOR, DEFAULT_SIZE);
        var serialized:String = RichBitmapMarkupSerializer.serialize(markup,
                DEFAULT_SIZE, DEFAULT_COLOR);
        assertEquals("A&amp;&lt;&gt;\ud83d\ude00", serialized,
                "serializer escapes literal markup delimiters only");
        assertEquals(markup.text, parse(serialized).text,
                "escaped serializer output round-trips visible Unicode");

        markup.clear();
        markup.text = "ABC";
        markup.colors.push(0xff0000, 0xff0000, DEFAULT_COLOR);
        markup.sizes.push(DEFAULT_SIZE, 18, 18);
        serialized = RichBitmapMarkupSerializer.serialize(markup,
                DEFAULT_SIZE, DEFAULT_COLOR);
        assertEquals("<font color='#ff0000'>A</font>" +
                "<font color='#ff0000' size='18'>B</font>" +
                "<font size='18'>C</font>", serialized,
                "serializer preserves independently overlapping styles");
        var reparsed:RichBitmapMarkup = parse(serialized);
        assertAt(reparsed, 0, 0xff0000, DEFAULT_SIZE,
                "serialized color-only run");
        assertAt(reparsed, 1, 0xff0000, 18,
                "serialized combined color and size run");
        assertAt(reparsed, 2, DEFAULT_COLOR, 18,
                "serialized size-only run");

        markup.clear();
        markup.text = "</font><script>owned()</script> &";
        fillStyles(markup, markup.text.length, 0x00000a, 12);
        serialized = RichBitmapMarkupSerializer.serialize(markup,
                DEFAULT_SIZE, DEFAULT_COLOR);
        assertTrue(serialized.indexOf("<script>") < 0,
                "visible text cannot inject a serializer tag");
        assertTrue(serialized.indexOf("color='#00000a'") >= 0,
                "serializer emits fixed-width safe RGB attributes");
        reparsed = parse(serialized);
        assertEquals(markup.text, reparsed.text,
                "injection-shaped visible text round-trips literally");
        assertRange(reparsed, 0, reparsed.text.length, 0x00000a, 12,
                "injection-shaped text retains requested style");
    }

    private function testEscapedLiteralMarkup():void {
        var result:RichBitmapMarkup = parse(
                "&lt;font color='#ff0000'&gt;literal&lt;/font&gt;");
        assertEquals("<font color='#ff0000'>literal</font>", result.text,
                "escaped angle brackets remain literal text");
        assertAllDefault(result,
                "decoded entity text must not be reparsed as markup");
    }

    private function testMalformedAndUnknownTags():void {
        var result:RichBitmapMarkup = parse(
                "A<banana>B</banana>C<unknown value='x'>D</unknown>E " +
                "2 < 3 and lone < plus <font color='#ff0000'");
        assertEquals(
                "ABCDE 2 < 3 and lone < plus <font color='#ff0000'",
                result.text,
                "unknown tags are inert and malformed tag starts are literal");
        assertAllDefault(result,
                "unknown tags beginning with b/f must not change formatting");

        result = parse("A</font>B</b>C</i>D</u>E");
        assertEquals("ABCDE", result.text,
                "unmatched closing tags are harmless");
        assertAllDefault(result,
                "unmatched closing tags do not corrupt defaults");
    }

    private function testLongUnbrokenToken():void {
        var token:String = repeat("W", 4096);
        var start:int = getTimer();
        var result:RichBitmapMarkup = parse(
                "<font color='#010203' size='48'>" + token + "</font>");
        var elapsed:int = getTimer() - start;
        assertEquals(token, result.text,
                "parser preserves a long token for the layout layer");
        assertEquals(4096, result.colors.length,
                "long token has parallel formatting data");
        assertAt(result, 0, 0x010203, 48,
                "long token first character");
        assertAt(result, 4095, 0x010203, 48,
                "long token final character");
        assertTrue(elapsed < 1000,
                "4096-character parse should stay linear-time-ish (" +
                elapsed + " ms)");
    }

    private function testInjectionSafety():void {
        var result:RichBitmapMarkup = parse(
                "<font color=\"' onclick='owned\">X</font>" +
                "<a href='javascript:owned()'>click</a>" +
                "<img src='https://invalid/track.png'>" +
                "<script>owned()</script>" +
                "<l=\"https://invalid/\">link</l>" +
                "<f=\"ownedEvent\">event</f>");
        assertEquals("Xclickowned()linkevent", result.text,
                "active and legacy action tags are inert");
        assertAllDefault(result,
                "attribute injection cannot alter formatting");
    }

    private function testValidationAndResultReuse():void {
        var result:RichBitmapMarkup = parse(
                "<font color='not-a-color' size='nope'>bad</font>");
        assertEquals("bad", result.text, "invalid attributes retain text");
        assertAllDefault(result, "invalid attributes inherit defaults");

        result = parse("<font size='0.5'>a</font><font size='999'>b</font>");
        assertAt(result, 0, DEFAULT_COLOR, 1,
                "absolute size clamps to minimum");
        assertAt(result, 1, DEFAULT_COLOR, 256,
                "absolute size clamps to maximum");

        var reused:RichBitmapMarkup = new RichBitmapMarkup();
        RichBitmapMarkupParser.parse("first", 10, 0x123456, reused);
        var returned:RichBitmapMarkup = RichBitmapMarkupParser.parse(
                "x", DEFAULT_SIZE, DEFAULT_COLOR, reused);
        assertTrue(returned === reused,
                "optional output object is reused");
        assertEquals("x", returned.text,
                "reuse clears prior text");
        assertEquals(1, returned.sizes.length,
                "reuse clears prior sizes");
        assertEquals(1, returned.colors.length,
                "reuse clears prior colors");
    }

    private function testArtifactTokenContract():void {
        var token:String = ChatArtifactToken.encode("simple_42",
                "artifact-id_7");
        assertEquals("$artifact:simple_42:artifact-id_7$", token,
                "artifact encoder uses the portable wire form");
        var parsed:ChatArtifactToken = ChatArtifactToken.parseAt(
                "x" + token + "y", 1);
        assertTrue(parsed != null, "strict artifact token parses at its start");
        assertEquals("simple_42", parsed.playerId,
                "artifact token player id");
        assertEquals("artifact-id_7", parsed.artifactId,
                "artifact token artifact id");
        assertEquals(1, parsed.sourceBegin, "artifact token source begin");
        assertEquals(1 + token.length, parsed.sourceEnd,
                "artifact token source end");

        assertEquals("", ChatArtifactToken.encode("bad:id", "artifact"),
                "encoder rejects delimiter injection");
        assertTrue(ChatArtifactToken.parseAt(
                "$artifact:player:artifact", 0) == null,
                "missing terminator stays plain text");
        assertTrue(ChatArtifactToken.parseAt(
                "$artifact:player id:artifact$", 0) == null,
                "whitespace makes a token invalid");
        assertTrue(ChatArtifactToken.parseAt(
                "$Artifact:player:artifact$", 0) == null,
                "token prefix is intentionally case-sensitive");
        assertTrue(ChatArtifactToken.parseAt(
                "$artifact:player:artifact:extra$", 0) == null,
                "extra delimiters cannot be smuggled into an id");
        var maximumId:String = repeat("a", ChatArtifactToken.MAX_ID_LENGTH);
        var maximumToken:String = ChatArtifactToken.encode(maximumId,
                maximumId);
        assertTrue(ChatArtifactToken.parseAt(maximumToken, 0) != null,
                "maximum-length artifact identifiers remain valid");
        assertEquals("", ChatArtifactToken.encode(maximumId + "a", "x"),
                "overlong artifact identifiers are rejected");

        var registry:ChatArtifactTokenRegistry =
                new ChatArtifactTokenRegistry();
        assertEquals(ChatArtifactTokenRegistry.FALLBACK_LABEL,
                registry.resolveLabel("player", "artifact"),
                "unresolved registry entries have a stable label");
        registry.setLabel("player", "artifact", " [Omni-Dampener #7] ");
        assertEquals("[Omni-Dampener #7]",
                registry.resolveLabel("player", "artifact"),
                "registry normalizes and caches labels");
        registry.clear();
        assertEquals(ChatArtifactTokenRegistry.FALLBACK_LABEL,
                registry.resolveLabel("player", "artifact"),
                "registry clear drops session labels");
    }

    private function testArtifactTokenProjectionAndSerialization():void {
        var token:String = "$artifact:player_1:artifact-2$";
        var literal:RichBitmapMarkup = parse("A" + token + "B");
        assertEquals("A" + token + "B", literal.text,
                "artifact syntax is inert without an opt-in resolver");
        assertEquals(0, literal.atoms.length,
                "legacy parse creates no rich attachment atoms");

        var resolver:Function = function(playerId:String,
                artifactId:String, rawToken:String):String {
            assertEquals("player_1", playerId,
                    "resolver receives the player id");
            assertEquals("artifact-2", artifactId,
                    "resolver receives the artifact id");
            assertEquals(token, rawToken,
                    "resolver receives the exact portable token");
            return "[Omni-Dampener #2]";
        };
        var source:String = "A<font color='#123456'>" + token +
                "</font>B";
        var result:RichBitmapMarkup = RichBitmapMarkupParser.parse(source,
                DEFAULT_SIZE, DEFAULT_COLOR, null, resolver);
        assertEquals("A[Omni-Dampener #2]B", result.text,
                "opt-in parse projects an artifact label");
        assertEquals(1, result.atoms.length,
                "artifact projection records one atomic span");
        var begin:int = result.text.indexOf("[");
        var end:int = result.text.lastIndexOf("]") + 1;
        assertEquals(begin, result.atoms[0].visibleBegin,
                "artifact atom visible begin");
        assertEquals(end, result.atoms[0].visibleEnd,
                "artifact atom visible end");
        assertEquals(RichBitmapMarkupParser.ARTIFACT_LINK_COLOR,
                result.atoms[0].displayColor,
                "artifact label has a fixed display-only gold tint");
        assertRange(result, begin, end, 0x123456, DEFAULT_SIZE,
                "artifact source formatting remains intact for serialization");
        var copied:RichBitmapMarkup = new RichBitmapMarkup();
        result.copyAtomsTo(copied, begin, end);
        assertEquals(RichBitmapMarkupParser.ARTIFACT_LINK_COLOR,
                copied.atoms[0].displayColor,
                "artifact gold survives projection slices and adjacent edits");
        assertSourceSpan(result, begin, source.indexOf(token),
                source.indexOf(token) + token.length,
                "first artifact label unit maps to the full token");
        assertSourceSpan(result, end - 1, source.indexOf(token),
                source.indexOf(token) + token.length,
                "last artifact label unit maps to the full token");
        assertEquals(token, result.copyTextForVisibleRange(begin + 2,
                end - 2), "partial atomic copy preserves the wire token");
        assertEquals(begin, result.snapVisibleBackward(begin + 3),
                "backward selection snap cannot split an artifact");
        assertEquals(end, result.snapVisibleForward(begin + 3),
                "forward selection snap cannot split an artifact");
        assertEquals(begin, result.previousAtomicBoundary(end),
                "left/backspace crosses the complete artifact");
        assertEquals(end, result.nextAtomicBoundary(begin),
                "right/delete crosses the complete artifact");

        var serialized:String = RichBitmapMarkupSerializer.serialize(result,
                DEFAULT_SIZE, DEFAULT_COLOR);
        assertEquals(source, serialized,
                "display-only artifact tint does not alter wire markup");
        assertEquals(result.text, RichBitmapMarkupParser.parse(serialized,
                DEFAULT_SIZE, DEFAULT_COLOR, null, resolver).text,
                "artifact projection round-trips through serialization");

        var literalLabel:RichBitmapMarkup = RichBitmapMarkupParser.parse(
                token, DEFAULT_SIZE, DEFAULT_COLOR, null,
                function(playerId:String, artifactId:String,
                         rawToken:String):String {
                    return "<font color='#ff0000'>not markup</font>";
                });
        assertEquals("<font color='#ff0000'>not markup</font>",
                literalLabel.text,
                "resolved database labels are never reparsed as HTML");

        var artifactColored:RichBitmapMarkup = RichBitmapMarkupParser.parse(
                token, DEFAULT_SIZE, DEFAULT_COLOR, null,
                function(playerId:String, artifactId:String,
                         rawToken:String):Object {
                    return {"label": "[Artifact: Eternal Aegis]",
                            "color": 0x45b6ff};
                });
        assertEquals("[Artifact: Eternal Aegis]", artifactColored.text,
                "a structured resolver projects its artifact label");
        assertEquals(0x45b6ff, artifactColored.atoms[0].displayColor,
                "a structured resolver supplies the artifact display color");
        assertRange(artifactColored, 0, artifactColored.text.length,
                DEFAULT_COLOR, DEFAULT_SIZE,
                "artifact color remains display-only source metadata");
        assertEquals(token, RichBitmapMarkupSerializer.serialize(
                artifactColored, DEFAULT_SIZE, DEFAULT_COLOR),
                "artifact color never leaks into the portable wire token");
    }

    private static function parse(source:String):RichBitmapMarkup {
        var result:RichBitmapMarkup = RichBitmapMarkupParser.parse(
                source, DEFAULT_SIZE, DEFAULT_COLOR);
        assertTrue(result != null, "parse result is non-null");
        assertEquals(result.text.length, result.sizes.length,
                "sizes parallel text");
        assertEquals(result.text.length, result.colors.length,
                "colors parallel text");
        assertEquals(result.text.length, result.sourceStarts.length,
                "source starts parallel text");
        assertEquals(result.text.length, result.sourceEnds.length,
                "source ends parallel text");
        assertEquals(source.length, result.sourceLength,
                "serialized source length retained");
        return result;
    }

    private static function assertAllDefault(result:RichBitmapMarkup,
                                             message:String):void {
        assertRange(result, 0, result.text.length,
                DEFAULT_COLOR, DEFAULT_SIZE, message);
    }

    private static function assertRange(result:RichBitmapMarkup,
                                        start:int, end:int,
                                        color:uint, size:Number,
                                        message:String):void {
        for (var i:int = start; i < end; i++) {
            assertAt(result, i, color, size, message + " at " + i);
        }
    }

    private static function assertAt(result:RichBitmapMarkup, index:int,
                                     color:uint, size:Number,
                                     message:String):void {
        assertEquals(color, result.colors[index], message + " color");
        assertEquals(size, result.sizes[index], message + " size");
    }

    private static function assertSourceSpan(result:RichBitmapMarkup,
                                             index:int, start:int, end:int,
                                             message:String):void {
        assertEquals(start, result.sourceStarts[index],
                message + " source start");
        assertEquals(end, result.sourceEnds[index],
                message + " source end");
    }

    private static function fillStyles(result:RichBitmapMarkup, count:int,
                                       color:uint, size:Number):void {
        for (var i:int = 0; i < count; i++) {
            result.colors.push(color);
            result.sizes.push(size);
        }
    }

    private static function repeat(value:String, count:int):String {
        var result:String = "";
        while (count-- > 0) {
            result += value;
        }
        return result;
    }

    private static function assertTrue(value:Boolean, message:String):void {
        if (!value) {
            throw new Error(message);
        }
    }

    private static function assertEquals(expected:*, actual:*,
                                         message:String):void {
        if (expected !== actual) {
            throw new Error(message + " (expected " + expected +
                    ", got " + actual + ")");
        }
    }
}
}
