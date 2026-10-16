import assert from 'node:assert/strict';
import test from 'node:test';
import { heroDocumentHeaders } from '../src/lib/content/hero-document-policy.ts';
test('motion documents execute scripts without inheriting application authority', () => {
 const headers=heroDocumentHeaders('https://peruwonderstours.com/es');
 const csp=headers['Content-Security-Policy'];
 assert.match(csp,/sandbox allow-scripts;/);
 assert.doesNotMatch(csp,/allow-same-origin|allow-top-navigation|unsafe-eval/);
 for(const directive of ["connect-src 'none'", "frame-src 'none'", "form-action 'none'", "worker-src 'none'"]) assert.ok(csp.includes(directive));
 assert.equal(headers['Cache-Control'],'no-store');
 assert.equal(headers['X-Content-Type-Options'],'nosniff');
});
test('document image policy uses only the parsed application origin',()=>{
 const csp=heroDocumentHeaders('https://peruwonderstours.com/es?destination=external')['Content-Security-Policy'];
 assert.ok(csp.includes('https://peruwonderstours.com;'));
 assert.ok(!csp.includes('destination='));
});
