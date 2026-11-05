import { describe, expect, it } from 'vitest';
import { environmentSearch } from '../navigation';

describe('Navegação entre áreas', () => {
  it('preserva o environment sem levar a visão de serviços para a entrada Containers', () => {
    expect(environmentSearch('?env=1a12&view=services&filter=web')).toBe('?env=1a12');
  });
  it('não propaga parâmetros de telas sem environment', () => {
    expect(environmentSearch('?view=containers')).toBe('');
  });
});
