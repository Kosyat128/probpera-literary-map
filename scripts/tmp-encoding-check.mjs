import { TextEncoder, TextDecoder } from 'util';

const enc = new TextEncoder('windows-1251');
const dec = new TextDecoder('utf-8');

const line = 'Мнение о книге';
const rec = dec.decode(enc.encode(line));
console.log('line', line);
console.log('rec ', rec);
