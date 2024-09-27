const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const excludedPatterns = [
  /\.(pjs|png|jpg|jpeg|gif)$/, // Exclude image files
  /\.ai$/,                   // Exclude Adobe Illustrator files
  /\.eslintrc$/,             // Exclude ESLint config files
  /package-lock\.json$/,     // Exclude package-lock.json
  /\.idea/,                   // Exclude .idea directory
  /\.github/,
  /\.replit/,
  /\.vscode/,
  /\replit\.nix/,
];

function shouldExclude(file) {
  return excludedPatterns.some(pattern => pattern.test(file));
}

try {
  const result = execSync("git ls-files --exclude-standard", { encoding: 'utf8' });
  const files = result.split('\n').filter(Boolean); // Filter out empty lines

  // Filter files based on exclusion patterns
  const filteredFiles = files.filter(file => !shouldExclude(file));

  let totalLines = 0;

  filteredFiles.forEach(file => {
    // Resolve the full path and ensure it is correct
    const filePath = path.resolve(file.trim());

    // Check if the file exists before trying to read it
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lineCount = content.split('\n').length; // Count lines by splitting

      console.log(`File: ${filePath} | Lines: ${lineCount}`); // Log each file and its line count

      totalLines += lineCount;
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  });

  console.log(`Total lines: ${totalLines}`); // Log total lines at the end
} catch (error) {
  console.error('Error:', error.message);
}
