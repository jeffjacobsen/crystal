import { describe, it, expect } from 'vitest';
import { sanitizeGitOutput } from '../sanitizer';

describe('sanitizer', () => {
  describe('sanitizeGitOutput', () => {
    it('should handle plain text without modification', () => {
      const plainText = 'This is a simple git output message';
      expect(sanitizeGitOutput(plainText)).toBe(plainText);
    });

    it('should handle empty strings', () => {
      expect(sanitizeGitOutput('')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(sanitizeGitOutput(null as any)).toBe('');
      expect(sanitizeGitOutput(undefined as any)).toBe('');
    });

    describe('XSS prevention through HTML escaping', () => {
      it('should escape script tags', () => {
        const malicious = 'Error: <script>alert("XSS")</script> in file';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('Error: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; in file');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('</script>');
      });

      it('should escape inline JavaScript', () => {
        const malicious = 'Click <a href="javascript:alert(\'XSS\')">here</a>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('Click &lt;a href=&quot;javascript:alert(&#x27;XSS&#x27;)&quot;&gt;here&lt;/a&gt;');
        expect(sanitized).not.toContain('<a');
      });

      it('should escape event handlers', () => {
        const malicious = '<div onmouseover="alert(\'XSS\')">Hover me</div>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;div onmouseover=&quot;alert(&#x27;XSS&#x27;)&quot;&gt;Hover me&lt;/div&gt;');
        expect(sanitized).not.toContain('<div');
      });

      it('should handle already encoded entities', () => {
        const encoded = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
        const sanitized = sanitizeGitOutput(encoded);
        expect(sanitized).toBe('&amp;lt;script&amp;gt;alert(&quot;XSS&quot;)&amp;lt;/script&amp;gt;');
      });

      it('should escape iframe injections', () => {
        const malicious = '<iframe src="http://malicious.com"></iframe>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;iframe src=&quot;http://malicious.com&quot;&gt;&lt;/iframe&gt;');
        expect(sanitized).not.toContain('<iframe');
      });

      it('should escape object and embed tags', () => {
        const malicious = '<object data="malicious.swf"></object><embed src="bad.swf">';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toContain('&lt;object');
        expect(sanitized).toContain('&lt;embed');
      });

      it('should escape SVG-based XSS attempts', () => {
        const malicious = '<svg onload="alert(\'XSS\')"></svg>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;svg onload=&quot;alert(&#x27;XSS&#x27;)&quot;&gt;&lt;/svg&gt;');
      });

      it('should escape meta refresh attacks', () => {
        const malicious = '<meta http-equiv="refresh" content="0;url=http://evil.com">';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toContain('&lt;meta');
        expect(sanitized).not.toContain('<meta');
      });

      it('should escape base64 encoded JavaScript', () => {
        const malicious = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgpPC9zY3JpcHQ+">Click</a>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toContain('&lt;a href=');
      });
    });

    describe('HTML entities', () => {
      it('should escape angle brackets', () => {
        const text = 'Use < and > for comparison';
        const sanitized = sanitizeGitOutput(text);
        expect(sanitized).toBe('Use &lt; and &gt; for comparison');
      });

      it('should escape quotes', () => {
        const text = 'Error: Cannot find module "react"';
        const sanitized = sanitizeGitOutput(text);
        expect(sanitized).toBe('Error: Cannot find module &quot;react&quot;');
      });

      it('should escape ampersands', () => {
        const text = 'R&D department & Development team';
        const sanitized = sanitizeGitOutput(text);
        expect(sanitized).toBe('R&amp;D department &amp; Development team');
      });

      it('should escape single quotes', () => {
        const text = "It's working";
        const sanitized = sanitizeGitOutput(text);
        expect(sanitized).toBe("It&#x27;s working");
      });
    });

    describe('Git-specific content', () => {
      it('should preserve but escape file paths with angle brackets', () => {
        const gitOutput = 'Modified: /usr/local/bin/<script>test</script>.js';
        const sanitized = sanitizeGitOutput(gitOutput);
        expect(sanitized).toBe('Modified: /usr/local/bin/&lt;script&gt;test&lt;/script&gt;.js');
      });

      it('should preserve git diff markers after escaping', () => {
        const gitDiff = '--- a/file.js\n+++ b/file.js\n@@ -1,3 +1,3 @@';
        const sanitized = sanitizeGitOutput(gitDiff);
        expect(sanitized).toBe(gitDiff); // No special chars to escape
      });

      it('should escape branch names with special characters', () => {
        const gitOutput = 'Switched to branch \'feature/<script>xss</script>\'';
        const sanitized = sanitizeGitOutput(gitOutput);
        expect(sanitized).toBe('Switched to branch &#x27;feature/&lt;script&gt;xss&lt;/script&gt;&#x27;');
      });
    });

    describe('Complex attack scenarios', () => {
      it('should handle nested tag attempts', () => {
        const malicious = '<<script>script>alert("XSS")<</script>/script>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;&lt;script&gt;script&gt;alert(&quot;XSS&quot;)&lt;&lt;/script&gt;/script&gt;');
      });

      it('should handle malformed tags', () => {
        const malicious = '<script/src="http://evil.com/xss.js">';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;script/src=&quot;http://evil.com/xss.js&quot;&gt;');
      });

      it('should handle multiple attack vectors', () => {
        const malicious = `
          Normal text
          <script>alert('XSS1')</script>
          <img src=x onerror="alert('XSS2')">
          <a href="javascript:void(0)">Click</a>
          More normal text
        `;
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toContain('Normal text');
        expect(sanitized).toContain('More normal text');
        expect(sanitized).toContain('&lt;script&gt;');
        expect(sanitized).toContain('&lt;img');
        expect(sanitized).toContain('&lt;a href=');
      });

      it('should handle Unicode in XSS attempts', () => {
        const malicious = '<scr\\u0069pt>alert("XSS")</scr\\u0069pt>';
        const sanitized = sanitizeGitOutput(malicious);
        expect(sanitized).toBe('&lt;scr\\u0069pt&gt;alert(&quot;XSS&quot;)&lt;/scr\\u0069pt&gt;');
      });
    });

    describe('Performance considerations', () => {
      it('should handle very long strings efficiently', () => {
        const longString = 'Safe text '.repeat(10000);
        const start = Date.now();
        sanitizeGitOutput(longString);
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100); // Should process in under 100ms
      });

      it('should handle strings with many HTML entities', () => {
        const text = '<div>&amp;&quot;&apos;'.repeat(1000);
        const sanitized = sanitizeGitOutput(text);
        expect(sanitized).toBeTruthy();
        expect(sanitized).toContain('&lt;div&gt;&amp;amp;&amp;quot;&amp;apos;');
      });
    });

    describe('Output preservation', () => {
      it('should preserve whitespace and formatting', () => {
        const formatted = '  Line 1\n    Line 2\n\tTabbed line';
        const sanitized = sanitizeGitOutput(formatted);
        expect(sanitized).toBe(formatted); // No special chars to escape
      });

      it('should preserve URLs without modification', () => {
        const gitOutput = 'remote: https://github.com/user/repo.git';
        const sanitized = sanitizeGitOutput(gitOutput);
        expect(sanitized).toBe(gitOutput); // No special chars in URL
      });

      it('should escape email addresses with angle brackets', () => {
        const gitOutput = 'Author: John Doe <john@example.com>';
        const sanitized = sanitizeGitOutput(gitOutput);
        expect(sanitized).toBe('Author: John Doe &lt;john@example.com&gt;');
      });
    });
  });
});