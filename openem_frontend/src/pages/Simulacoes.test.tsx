import { fireEvent, render, screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REGISTRO } from '../components/simulacoes/registro';
import { MATERIAS_SIM, SIMULACOES, type MateriaSim } from '../lib/simulacoes/catalogo';
import Simulacao from './Simulacao';
import Simulacoes from './Simulacoes';
import SimulacoesMateria from './SimulacoesMateria';

// O texto de apoio passa pelo KaTeX, que é caro e já tem os próprios testes:
// aqui basta o Markdown cru, para a suíte não pesar nas outras em paralelo.
vi.mock('../components/Markdown', () => ({
  Markdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

// jsdom não tem canvas nem WebGL: o palco 2D fica vazio e o 3D mostra o aviso.
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('tela Simulações', () => {
  const montar = () =>
    render(
      <MemoryRouter>
        <Simulacoes />
      </MemoryRouter>,
    );

  it('abre nas matérias, cada uma com o link da sua lista', () => {
    montar();
    for (const m of MATERIAS_SIM) {
      expect(screen.getByRole('heading', { level: 2, name: m })).toBeInTheDocument();
    }
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(MATERIAS_SIM.length);
    expect(screen.getByRole('link', { name: /^Física/ })).toHaveAttribute('href', '/simulacoes/fisica');
    expect(screen.getByRole('link', { name: /^Geografia/ })).toHaveAttribute('href', '/simulacoes/geografia');
  });

  it('a busca procura em todas as matérias e, sem resultado, oferece limpar', () => {
    montar();
    const busca = screen.getByRole('searchbox', { name: 'Buscar simulação' });
    fireEvent.change(busca, { target: { value: 'titulação' } });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Titulação/ })).toHaveAttribute('href', '/simulacoes/titulacao');
    fireEvent.change(busca, { target: { value: 'xyzw' } });
    expect(screen.getByText('Nenhuma simulação encontrada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getAllByRole('link')).toHaveLength(MATERIAS_SIM.length);
  });

  it('o filtro "Só 3D" mostra as cenas 3D de todas as matérias', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Só 3D/ }));
    expect(screen.getAllByRole('link')).toHaveLength(SIMULACOES.filter((s) => s.dimensao === '3D').length);
  });
});

describe('tela de uma matéria', () => {
  const montar = (materia: MateriaSim) =>
    render(
      <MemoryRouter>
        <SimulacoesMateria materia={materia} />
      </MemoryRouter>,
    );

  it('lista as simulações da matéria, com atalhos para as outras', () => {
    montar('Química');
    expect(screen.getByRole('heading', { level: 1, name: 'Química' })).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Simulações de Química' });
    const daQuimica = SIMULACOES.filter((s) => s.materia === 'Química');
    expect(within(lista).getAllByRole('link')).toHaveLength(daQuimica.length);
    const atalhos = screen.getByRole('navigation', { name: 'Matérias' });
    expect(within(atalhos).getByRole('link', { name: 'Química' })).toHaveAttribute('aria-current', 'page');
    expect(within(atalhos).getByRole('link', { name: 'Física' })).toHaveAttribute('href', '/simulacoes/fisica');
    expect(screen.getByRole('link', { name: 'Simulações' })).toHaveAttribute('href', '/simulacoes');
  });

  it('"Só 3D" aparece só quando a matéria tem 2D e 3D', () => {
    montar('Física');
    fireEvent.click(screen.getByRole('button', { name: /Só 3D/ }));
    const lista = screen.getByRole('list', { name: 'Simulações de Física' });
    expect(within(lista).getAllByRole('link')).toHaveLength(SIMULACOES.filter((s) => s.materia === 'Física' && s.dimensao === '3D').length);
  });

  it('sem 2D e 3D juntos, não há filtro', () => {
    montar('Geografia');
    expect(screen.queryByRole('button', { name: /Só 3D/ })).not.toBeInTheDocument();
  });
});

function abrir(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/simulacoes/${slug}`]}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/simulacoes" element={<p>lista</p>} />
          <Route path="/simulacoes/:slug" element={<Simulacao />} />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
}

describe('tela de uma simulação', () => {
  it('slug desconhecido volta para a lista', () => {
    abrir('nao-existe');
    expect(screen.getByText('lista')).toBeInTheDocument();
  });

  // Monta cada simulação de verdade: pega erro de renderização em qualquer uma.
  it.each(Object.keys(REGISTRO))('%s abre com controles e explicação', async (slug) => {
    abrir(slug);
    const info = SIMULACOES.find((s) => s.slug === slug)!;
    expect(screen.getByRole('heading', { level: 1, name: info.titulo })).toBeInTheDocument();
    expect(await screen.findByRole('complementary', { name: 'Controles da simulação' }, { timeout: 15_000 })).toBeInTheDocument();
    // A explicação abre num modal, para a cena caber na tela.
    fireEvent.click(await screen.findByRole('button', { name: 'Entenda' }));
    const modal = screen.getByRole('dialog', { name: info.titulo });
    expect(within(modal).getByRole('heading', { name: 'No ENEM' })).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // O átomo abre em 2D e tem o próprio teste para o 3D.
    if (info.dimensao === '3D' && slug !== 'atomo') expect(screen.getByText(/precisa de WebGL/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Outras simulações' })).toBeInTheDocument();
    // O caminho volta para a lista da matéria.
    const caminho = screen.getByRole('navigation', { name: 'Caminho' });
    expect(within(caminho).getByRole('link', { name: info.materia })).toHaveAttribute('href', expect.stringMatching(/^\/simulacoes\/[a-z]+$/));
  }, 20_000); // as 3D importam o three.js: com a suíte inteira em paralelo, demora

  it('Gráficos de funções: o aluno digita a própria função', async () => {
    abrir('funcoes');
    fireEvent.click(await screen.findByRole('radio', { name: 'Sua função' }, { timeout: 15_000 }));
    const f = screen.getByRole('textbox', { name: 'f(x) =' });
    fireEvent.change(f, { target: { value: 'x^2 - 4' } });
    expect(screen.getByText('-2; 2')).toBeInTheDocument(); // os zeros
    fireEvent.change(screen.getByRole('textbox', { name: 'g(x) =' }), { target: { value: 'x + 2' } });
    expect(screen.getByText('-2; 3')).toBeInTheDocument(); // f = g em x = −2 e 3
    fireEvent.change(f, { target: { value: 'a x^2 + y' } });
    expect(f).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/letra "y"/)).toBeInTheDocument();
    fireEvent.change(f, { target: { value: 'a x^2' } });
    expect(screen.getByRole('slider', { name: 'Parâmetro a' })).toBeInTheDocument();
  }, 20_000);

  it('Monte um átomo: isótopos e íons que existem, e o 3D', async () => {
    abrir('atomo');
    const nêutron = await screen.findByRole('button', { name: 'Pôr um nêutron' }, { timeout: 15_000 });
    // Carbono-12 → 13 → 14 (radioativo, 5.700 anos).
    fireEvent.click(nêutron);
    fireEvent.click(nêutron);
    expect(screen.getByText('Isótopo ¹⁴C')).toBeInTheDocument();
    expect(screen.getAllByText(/700 anos/).length).toBeGreaterThan(0);
    // Pôr nêutrons até travar no último isótopo conhecido.
    for (let i = 0; i < 30 && !(nêutron as HTMLButtonElement).disabled; i++) fireEvent.click(nêutron);
    expect(nêutron).toBeDisabled();
    // Íon: o oxigênio aceita até 2 elétrons a mais (O²⁻), não 3.
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento' }), { target: { value: '8' } });
    const eletron = screen.getByRole('button', { name: 'Pôr um elétron' });
    fireEvent.click(eletron);
    fireEvent.click(eletron);
    expect(eletron).toBeDisabled();
    expect(screen.getByText(/O²⁻/, { selector: 'dd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '3D' }));
    expect(screen.getByText(/precisa de WebGL/)).toBeInTheDocument();
  }, 20_000);

  it('Ligações químicas: dois elementos quaisquer da tabela', async () => {
    abrir('ligacoes');
    await screen.findByRole('combobox', { name: 'Elemento 1' }, { timeout: 15_000 });
    expect(screen.getByText('NaCl', { selector: 'dd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Al₂O₃' }));
    expect(screen.getByText('Al₂O₃', { selector: 'dd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'H₂O' }));
    expect(screen.getByText('angular', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('polar', { selector: 'dd' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento 1' }), { target: { value: '26' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Elemento 2' }), { target: { value: '8' } });
    // Ferro: escolher entre Fe³⁺ (Fe₂O₃) e Fe²⁺ (FeO).
    fireEvent.click(screen.getByRole('radio', { name: 'Fe²⁺' }));
    expect(screen.getByText('FeO', { selector: 'dd' })).toBeInTheDocument();
  }, 20_000);

  it('mexer num controle atualiza as medidas (lançamento sem ar)', async () => {
    abrir('lancamento-obliquo');
    const ar = await screen.findByRole('switch', { name: 'Resistência do ar' });
    fireEvent.click(ar);
    const angulo = screen.getByRole('slider', { name: 'Ângulo de lançamento' });
    fireEvent.change(angulo, { target: { value: '45' } });
    const v0 = screen.getByRole('slider', { name: 'Velocidade inicial' });
    fireEvent.change(v0, { target: { value: '20' } });
    // Do chão, sem ar: A = v0²/g = 400/9,81 = 40,8 m.
    expect(screen.getAllByText('40,8 m').length).toBeGreaterThan(0);
  });
});
