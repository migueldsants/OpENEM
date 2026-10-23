// Testes da tela Tabela periódica, sobre o catálogo real.
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TabelaPeriodica from './TabelaPeriodica';

function Endereco() {
  const l = useLocation();
  return <output data-testid="endereco">{l.pathname + l.search}</output>;
}

function renderPage(rota = '/tabela-periodica') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route
          path="/tabela-periodica"
          element={
            <>
              <TabelaPeriodica />
              <Endereco />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const casa = (nome: RegExp) => screen.getByRole('gridcell', { name: nome });
const endereco = () => screen.getByTestId('endereco').textContent;

/**
 * Configuração escrita com expoentes ("[Ar] 4s2 3d6" em <sup>): acha o menor
 * elemento cujo texto, juntando os pedaços, é exatamente o pedido.
 */
const config = (texto: string) => (_: string, el: Element | null) =>
  el?.textContent === texto && ![...(el?.children ?? [])].some((c) => c.textContent === texto);

beforeEach(() => {
  localStorage.clear();
});

// A grade tem 118 casas e o jsdom é lento para montar e trocar todas.
describe('TabelaPeriodica', { timeout: 20000 }, () => {
  it('mostra os 118 elementos na grade, com o leitor de tela dizendo nome, número e categoria', async () => {
    renderPage();
    const grade = await screen.findByRole('grid', { name: 'Tabela periódica dos elementos' });
    const casas = within(grade)
      .getAllByRole('gridcell')
      .filter((c) => c.classList.contains('tp-casa'));
    expect(casas).toHaveLength(118);
    expect(casa(/^Ferro, número atômico 26, metal de transição$/)).toBeInTheDocument();
    // Só uma casa entra no Tab (grid com tabindex móvel).
    expect(casas.filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('anda pelas setas pulando as casas vazias, e Enter abre a ficha', async () => {
    renderPage();
    await screen.findByRole('grid');
    const h = casa(/^Hidrogênio/);
    act(() => h.focus());
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(casa(/^Hélio/));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(casa(/^Neônio/));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(casa(/^Lítio/));
    expect(casa(/^Lítio/).tabIndex).toBe(0);
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: 'Lítio' })).toBeInTheDocument();
    expect(endereco()).toBe('/tabela-periodica?z=3');
  });

  it('a ficha traz os dados com a fonte de cada um e fecha com Esc', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('gridcell', { name: /^Ferro/ }));
    const ficha = await screen.findByRole('dialog', { name: 'Ferro' });
    expect(within(ficha).getByText('55,845(2)')).toBeInTheDocument();
    expect(within(ficha).getByText(config('[Ar] 4s2 3d6'))).toBeInTheDocument();
    expect(within(ficha).getAllByRole('link', { name: 'CIAAW 2024' }).length).toBeGreaterThan(0);
    expect(within(ficha).getAllByRole('link', { name: 'NIST' })[0]).toHaveAttribute('href', expect.stringMatching(/^https:\/\/physics\.nist\.gov/));
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(() => new Promise((r) => setTimeout(r, 250)));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(endereco()).toBe('/tabela-periodica');
  });

  it('abre direto pelo endereço e marca o que é previsto', async () => {
    renderPage('/tabela-periodica?z=118');
    const ficha = await screen.findByRole('dialog', { name: 'Oganessono' });
    expect(within(ficha).getByText(/também oganessônio/)).toBeInTheDocument();
    expect(within(ficha).getAllByText('Gás nobre (previsto)').length).toBeGreaterThan(0);
    expect(within(ficha).getByText('prevista')).toBeInTheDocument();
    expect(within(ficha).getByText('previsto: gasoso')).toBeInTheDocument();
  });

  it('mostra a exceção ao diagrama de Pauling', async () => {
    renderPage('/tabela-periodica?z=24');
    const ficha = await screen.findByRole('dialog', { name: 'Cromo' });
    expect(within(ficha).getByText('Exceção ao diagrama de Pauling')).toBeInTheDocument();
    expect(within(ficha).getByText(config('[Ar] 4s2 3d4'))).toBeInTheDocument();
  });

  it('busca sem acento apaga o resto da tabela', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.change(screen.getByPlaceholderText('Nome, símbolo ou número'), { target: { value: 'potassio' } });
    expect(screen.getByText('1 de 118 elementos')).toBeInTheDocument();
    expect(casa(/^Potássio/)).not.toHaveAttribute('data-apagada');
    expect(casa(/^Sódio/)).toHaveAttribute('data-apagada');
    fireEvent.keyDown(screen.getByPlaceholderText('Nome, símbolo ou número'), { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: 'Potássio' })).toBeInTheDocument();
  });

  it('filtra por grupo e categoria, e a legenda também filtra', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '17' } });
    expect(screen.getByText('6 de 118 elementos')).toBeInTheDocument();
    expect(casa(/^Cloro/)).not.toHaveAttribute('data-apagada');
    expect(casa(/^Oxigênio/)).toHaveAttribute('data-apagada');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('118 elementos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gases nobres' }));
    expect(screen.getByText('7 de 118 elementos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lantanídeos, 57 a 71/ }));
    expect(screen.getByText('15 de 118 elementos')).toBeInTheDocument();
  });

  it('colore por propriedade, com desconhecido sem cor da escala, e mostra as setas de tendência', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.change(screen.getByLabelText('Colorir por'), { target: { value: 'calor:eletronegatividade' } });
    expect(casa(/^Hélio/)).toHaveAttribute('data-desconhecido');
    expect(casa(/^Flúor/)).not.toHaveAttribute('data-desconhecido');
    expect(casa(/^Férmio/)).toHaveAttribute('data-estimado');
    fireEvent.click(screen.getByRole('button', { name: 'Setas de tendência' }));
    expect(screen.getByText(/É a tendência de atrair os elétrons de uma ligação/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Colorir por'), { target: { value: 'estado' } });
    expect(screen.getByRole('button', { name: 'Setas de tendência' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Temperatura')).toBeInTheDocument();
  });

  it('muda o estado físico com a temperatura', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.change(screen.getByLabelText('Colorir por'), { target: { value: 'estado' } });
    // A 25 °C o mercúrio é líquido; a 700 K (427 °C) já ferveu (ferve a 357 °C).
    const tom = (nome: RegExp) => casa(nome).style.getPropertyValue('--tom');
    expect(tom(/^Mercúrio/)).toBe('var(--tp-transicao)');
    fireEvent.change(screen.getByLabelText('Temperatura'), { target: { value: '700' } });
    expect(tom(/^Mercúrio/)).toBe('var(--tp-alcalino-terroso)');
    expect(tom(/^Ferro/)).toBe('var(--tp-pos-transicao)');
  });

  it('a lista mostra os elementos por período', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByRole('heading', { name: 'Período 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Período 7' })).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Nome, símbolo ou número'), { target: { value: 'xyzw' } });
    expect(screen.getByText('Nenhum elemento')).toBeInTheDocument();
  });

  it('as ferramentas: massa molar, distribuição de íon e comparação', async () => {
    renderPage();
    await screen.findByRole('grid');
    fireEvent.click(screen.getByRole('tab', { name: 'Massa molar' }));
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: 'H2O' } });
    expect(screen.getByText(/^18,015/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: 'Xy' } });
    expect(screen.getByText('"Xy" não é o símbolo de um elemento.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Distribuição eletrônica' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar a carga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar a carga' }));
    expect(screen.getByText(config('Fe2+'))).toBeInTheDocument();
    expect(screen.getByText(config('[Ar] 3d6'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Comparar' }));
    expect(screen.getByRole('table', { name: 'Sódio comparado com Cloro' })).toBeInTheDocument();
  });
});
