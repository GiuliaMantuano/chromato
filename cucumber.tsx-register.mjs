// Registers tsx's ESM loader hook so cucumber-js can import .ts step files.
// Official cucumber-js + tsx ESM recipe (cucumber-js docs: transpiling.md).
import { register } from 'tsx/esm/api';
register();
