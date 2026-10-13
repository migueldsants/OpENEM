// Testes da tela de Redações, sobre o catálogo real.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Redacoes from './Redacoes';

function renderPage(rota = '/redacoes') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Redacoes />
    </MemoryRouter>,
  );
}

const TEMA_2023 =
  'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil';

describe('Redacoes', () => {
  it('lista os temas agrupados por ano, do mais recente para o mais antigo', async () => {
    renderPage();
    expect(await screen.findByText(TEMA_2023)).toBeInTheDocument();
    const anos = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => Number(h.textContent));
    expect(anos[0]).toBe(2025);
    expect(anos[anos.length - 1]).toBe(1998);
    expect(anos).toEqual([...anos].sort((a, b) => b - a));
  });

  it('filtra pela aplicação', async () => {
    renderPage();
    await screen.findByText(TEMA_2023);
    fireEvent.click(
      screen.getByRole('button', { name: 'PPL e outras aplicações' }),
    );
    expect(screen.queryByText(TEMA_2023)).not.toBeInTheDocument();
    expect(
      screen.getByText(/população em situação de rua no Brasil/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aplicação regular', { selector: 'span' })).toBeNull();
  });

  it('busca por ano e por palavra do tema, sem exigir acento', async () => {
    renderPage();
    await screen.findByText(TEMA_2023);
    const busca = screen.getByLabelText('Buscar tema de redação');

    fireEvent.change(busca, { target: { value: 'democratizacao cinema' } });
    expect(
      screen.getByText('Democratização do acesso ao cinema no Brasil'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);

    fireEvent.change(busca, { target: { value: 'tema que nao existe' } });
    expect(screen.getByText('Nenhum tema encontrado')).toBeInTheDocument();
  });

  it('abre a proposta com o comando, os textos motivadores e a fonte oficial', async () => {
    renderPage();
    fireEvent.click((await screen.findByText(TEMA_2023)).closest('button')!);

    expect(
      screen.getByRole('heading', { level: 1, name: TEMA_2023 }),
    ).toBeInTheDocument();
    expect(screen.getByText('ENEM 2023 · Aplicação regular')).toBeInTheDocument();
    expect(screen.getByText(/redija texto dissertativo-argumentativo/)).toBeInTheDocument();

    // O comando e os quatro textos motivadores.
    const [comando, ...textos] = screen.getAllByRole('article');
    expect(comando).toHaveAccessibleName('Proposta de redação');
    expect(textos).toHaveLength(4);
    expect(within(textos[0]).getByText('Texto I')).toBeInTheDocument();
    expect(
      within(textos[0]).getByText(/O trabalho de cuidado é essencial/),
    ).toBeInTheDocument();
    // A capa de revista do Texto IV entra como figura, com descrição.
    const figura = within(textos[3]).getByRole('img');
    expect(figura).toHaveAttribute('src', expect.stringMatching(/^\/redacoes\/2023-regular-/));
    expect(figura.getAttribute('alt')).toMatch(/Desafios do cuidado/);

    expect(
      screen.getByRole('link', { name: 'Ver o caderno original (PDF)' }),
    ).toHaveAttribute(
      'href',
      'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_PV_impresso_D1_CD1.pdf',
    );

    // A página do caderno, inteira, vem antes de tudo: é o documento oficial.
    const pagina = screen.getByAltText(/como impressa no caderno/);
    expect(pagina).toHaveAttribute('src', '/redacoes/2023-regular-pagina.webp');
    expect(
      pagina.compareDocumentPosition(comando) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Negrito do caderno preservado: o título da obra na referência.
    expect(within(textos[0]).getByText('Documento informativo – Tempo de Cuidar.').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: 'Todos os temas' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Redações' })).toBeInTheDocument();
  });

  it('abre direto pelo link e exibe o texto I como imagem do caderno', async () => {
    renderPage('/redacoes?tema=1998-regular');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Viver e Aprender' }),
    ).toBeInTheDocument();
    // O texto I de 1998 tem fonte ilegível no PDF; aparece como imagem do caderno.
    const textoI = screen.getAllByRole('article')[1];
    expect(within(textoI).getByRole('img')).toHaveAttribute(
      'src',
      expect.stringMatching(/^\/redacoes\/1998-regular-/),
    );
  });

  it('conta as propostas do recorte', async () => {
    renderPage();
    await screen.findByText(TEMA_2023);
    expect(screen.getByText('48 propostas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicação regular' }));
    expect(screen.getByText('28 propostas')).toBeInTheDocument();
  });

  it('leva à proposta vizinha, mais recente ou mais antiga', async () => {
    renderPage('/redacoes?tema=1999-regular');
    await screen.findByRole('heading', { level: 1, name: /Cidadania e participação social/ });
    const outras = screen.getByRole('navigation', { name: 'Outras propostas' });
    expect(within(outras).getAllByRole('button')).toHaveLength(2);

    fireEvent.click(within(outras).getByRole('button', { name: /Mais antiga/ }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Viver e Aprender' }),
    ).toBeInTheDocument();
    // 1998 é a última: só resta o caminho de volta.
    const fim = screen.getByRole('navigation', { name: 'Outras propostas' });
    expect(within(fim).getAllByRole('button')).toHaveLength(1);
    expect(within(fim).getByRole('button', { name: /Mais recente/ })).toBeInTheDocument();
  });

  it('abre a página do caderno em tamanho real ao tocar nela', async () => {
    renderPage('/redacoes?tema=2023-regular');
    const pagina = await screen.findByAltText(/como impressa no caderno/);
    expect(pagina.closest('a')).toHaveAttribute('href', '/redacoes/2023-regular-pagina.webp');
    expect(pagina.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('não inventa rótulo nos cadernos que não numeram os textos', async () => {
    renderPage('/redacoes?tema=2012-regular');
    const [, ...textos] = await screen.findAllByRole('article');
    expect(textos).toHaveLength(3);
    expect(screen.queryByText(/^Texto I$/)).not.toBeInTheDocument();
    expect(textos[0]).toHaveAccessibleName('Texto motivador 1');
  });

  it('não inventa tema para a prova que não tem frase-tema', async () => {
    renderPage();
    await screen.findByText(TEMA_2023);
    // Na lista, o cartão de 2008 mostra o começo do próprio comando.
    fireEvent.click(
      screen.getByText(/menciona a “máquina de chuva da Amazônia”/).closest('button')!,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Proposta de redação' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/não traz uma frase-tema/)).toBeInTheDocument();
  });
});
