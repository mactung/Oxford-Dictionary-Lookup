import { describe, it, expect } from 'vitest';
import { parseOxfordHTML } from './parser';

describe('parseOxfordHTML', () => {
    it('should parse basic headword and pos', () => {
        const html = `
            <div class="entry">
                <div class="webtop">
                    <h1 class="headword">test</h1>
                    <span class="pos">noun</span>
                </div>
                <div class="sense">
                    <span class="def">a procedure intended to establish the quality</span>
                </div>
            </div>
        `;
        const result = parseOxfordHTML(html);
        expect(result.headword).toBe('test');
        expect(result.pos).toBe('noun');
        expect(result.senses[0].definition).toBe('a procedure intended to establish the quality');
    });

    it('should limit phonetics to 1 BrE and 1 NAmE', () => {
        const html = `
            <div class="entry">
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
            <div class="entry">
                <div class="webtop"><h1 class="headword">happy</h1></div>
                <div class="sense">
                    <span class="def">feeling or showing pleasure</span>
                    <span class="xr_s">cheerful</span>
                    <span class="xr_s">joyful</span>
                </div>
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

    it('should extract rich data including verb forms, phrasal verbs, and CEFR', () => {
        const html = `
            <div class="entry">
                <div class="webtop">
                    <h1 class="headword">make</h1>
                    <span class="pos">verb</span>
                </div>
                
                <div class="sense" cefr="a1">
                    <span class="ox3000"><span class="ox3ksym_a1"></span></span>
                    <span class="def">to create something</span>
                    <ul class="examples">
                        <li>
                            <span class="cf">make something</span>
                            <span class="x">to make a table</span>
                        </li>
                    </ul>
                </div>

                <div class="unbox" unbox="verbforms">
                    <table class="verb_forms_table">
                        <tr>
                            <th>present simple</th>
                            <td>make</td>
                        </tr>
                        <tr>
                            <th>past tense</th>
                            <td>made</td>
                        </tr>
                    </table>
                </div>

                <div class="phrasal_verb_links">
                    <ul>
                        <li><a href="#">make up</a></li>
                        <li><a href="#">make out</a></li>
                    </ul>
                </div>

                <div class="unbox" unbox="vocab">
                    <span class="box_title">Vocabulary Building</span>
                    <span class="body">Household jobs</span>
                </div>
            </div>
        `;
        const result = parseOxfordHTML(html);

        expect(result.headword).toBe('make');
        // CEFR
        expect(result.senses[0].cefr).toBe('A1');

        // Verb Forms
        expect(result.verbForms).toHaveLength(2);
        expect(result.verbForms[1].form).toBe('past tense');
        expect(result.verbForms[1].value).toBe('made');

        // Phrasal Verbs
        expect(result.phrasalVerbs).toContain('make up');
        expect(result.phrasalVerbs).toContain('make out');

        // Pattern Check
        expect(result.senses[0].examples[0].pattern).toBe('make something');
        expect(result.senses[0].examples[0].text).toBe('to make a table');

        // Topics
        expect(result.topics[0]).toContain('Vocabulary Building: Household jobs');
    });
});
