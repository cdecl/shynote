const marked = require('marked');

// Mock renderer as in app.js
const renderer = new marked.Renderer();

const content = `## test 
- 1
- 2
- 3
- 4


- 22
- 22
- 33
`;

const options = {
	renderer: renderer,
	gfm: true,
	breaks: true
};

console.log(marked.parse(content, options));
