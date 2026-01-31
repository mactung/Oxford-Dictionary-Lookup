import { describe, it, expect } from 'vitest';
import { parseOxfordHTML } from './parser';

describe('parseOxfordHTML', () => {
    it('should parse basic headword and pos', () => {
        const html = `
            <div class="webtop">
                <h1 class="headword">test</h1>
                <span class="pos">noun</span>
            </div>
            <div class="sense">
                <span class="def">a procedure intended to establish the quality</span>
            </div>
        `;
        const result = parseOxfordHTML(html);
        expect(result.headword).toBe('test');
        expect(result.pos).toBe('noun');
        expect(result.senses[0].definition).toBe('a procedure intended to establish the quality');
    });

    it('should limit phonetics to 1 BrE and 1 NAmE', () => {
        const html = `
            <div class="webtop">
                <h1 class="headword">test</h1>
                <div class="phonetics">
                    <div class="phons_br">
                        <span class="phon">br1</span>
                    </div>
                    <div class="phons_br">
                        <span class="phon">br2</span>
                    </div>
                    <div class="phons_n_am">
                        <span class="phon">us1</span>
                    </div>
                     <div class="phons_n_am">
                        <span class="phon">us2</span>
                    </div>
                </div>
            </div>
        `;
        const result = parseOxfordHTML(html);
        expect(result.phonetics).toHaveLength(2);
        expect(result.phonetics[0].type).toBe('BrE');
        expect(result.phonetics[0].ipa).toBe('br1');
        expect(result.phonetics[1].type).toBe('NAmE');
        expect(result.phonetics[1].ipa).toBe('us1');
    });

    it('should extract synonyms', () => {
        const html = `
            <div class="webtop"><h1 class="headword">happy</h1></div>
            <div class="sense">
                <span class="def">feeling or showing pleasure</span>
                <span class="xr_s">cheerful</span>
                <span class="xr_s">joyful</span>
            </div>
        `;
        const result = parseOxfordHTML(html);
        expect(result.senses[0].synonyms).toEqual(['cheerful', 'joyful']);
    });

    it('should extract idioms', () => {
        const html = `
            <div class="webtop"><h1 class="headword">break</h1></div>
             <div class="idm-g">
                <div class="idm">break a leg</div>
                <div class="def">good luck</div>
            </div>
        `;
        const result = parseOxfordHTML(html);
        expect(result.idioms).toHaveLength(1);
        expect(result.idioms[0].phrase).toBe('break a leg');
        expect(result.idioms[0].definition).toBe('good luck');
    });

    it('should return error if not found', () => {
        const html = '<div>Nothing here</div>';
        const result = parseOxfordHTML(html);
        expect(result.error).toBe('Definition not found.');
    });
});
