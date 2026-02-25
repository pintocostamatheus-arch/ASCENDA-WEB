"""
Definitive fix for mojibake in all JS files.
The corruption chain was: UTF-8 bytes -> interpreted as Windows-1252 -> re-encoded as UTF-8.
Fix: decode UTF-8 text, encode as Latin-1, then decode as UTF-8 again.
This reverses the double-encoding for all characters including emojis.
"""
import glob, os

def fix_mojibake(text):
    """Fix text that was UTF-8, misread as CP1252, then re-encoded as UTF-8."""
    fixed = []
    i = 0
    fixes = 0
    
    while i < len(text):
        # Try to find mojibake sequences: look for multi-byte chars that form valid UTF-8
        # when decoded back through Latin-1
        # Typical mojibake: Ã° Å¸ (= F0 9F in original) followed by more pairs
        
        # Try greedily: take as many chars as possible (up to 12 for a ZWJ emoji sequence)
        found = False
        for length in range(12, 1, -1):
            if i + length > len(text):
                continue
            candidate = text[i:i+length]
            
            # Only try if it starts with a high-byte character
            if ord(candidate[0]) < 0x80:
                continue
            
            try:
                # Encode as Latin-1 (reverses the CP1252->UTF8 step)
                raw = candidate.encode('latin-1')
                # Try to decode as UTF-8
                decoded = raw.decode('utf-8')
                
                # Verify it's a real improvement (shorter output, valid content)
                if len(decoded) < len(candidate) and all(ord(c) >= 0x20 or c in '\r\n\t' for c in decoded):
                    fixed.append(decoded)
                    i += length
                    fixes += 1
                    found = True
                    break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
        
        if not found:
            fixed.append(text[i])
            i += 1
    
    return ''.join(fixed), fixes


def fix_file(filepath):
    with open(filepath, 'rb') as f:
        raw = f.read()
    
    has_bom = raw.startswith(b'\xef\xbb\xbf')
    content_bytes = raw[3:] if has_bom else raw
    text = content_bytes.decode('utf-8')
    
    fixed_text, count = fix_mojibake(text)
    
    if count > 0:
        with open(filepath, 'wb') as f:
            if has_bom:
                f.write(b'\xef\xbb\xbf')
            f.write(fixed_text.encode('utf-8'))
    
    return count


# Process all JS files
base = r'd:\Documentos\GEMINI\ASCENDA WEB\js'
files = [os.path.join(base, 'app.js')]
files += glob.glob(os.path.join(base, 'controllers', '*.js'))
files += glob.glob(os.path.join(base, 'services', '*.js'))

total = 0
for f in files:
    try:
        n = fix_file(f)
        if n > 0:
            print(f'Fixed {n} mojibake sequences in {os.path.basename(f)}')
        total += n
    except Exception as e:
        print(f'ERROR in {os.path.basename(f)}: {e}')

print(f'\nTotal: {total} fixes across {len(files)} files')

# Verify specific emojis
for f in [os.path.join(base, 'app.js'), 
          os.path.join(base, 'controllers', 'journey-controller.js'),
          os.path.join(base, 'controllers', 'symptoms-controller.js')]:
    with open(f, 'r', encoding='utf-8-sig') as fh:
        content = fh.read()
    # Check for common mojibake indicators
    has_issues = False
    if 'ðŸ' in content:
        has_issues = True
    if 'Ã' in content and 'Object.assign' not in content[:100]:
        # Ã followed by another char is suspicious
        for line_num, line in enumerate(content.split('\n'), 1):
            if 'ðŸ' in line or 'Ã\xb0' in line:
                print(f'  REMAINING ISSUE in {os.path.basename(f)}:{line_num}: {line.strip()[:80]}')
                has_issues = True
    if not has_issues:
        print(f'  ✓ {os.path.basename(f)} is clean')

print('\nDone!')
