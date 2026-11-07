import { TAXONOMY } from '../common/taxonomy';
import {
  LANGUAGE_TOPICS,
  MAX_TOPICS_PER_STAGE,
  MAX_WHY_LENGTH,
  SUBJECTS_WITHOUT_TRACK,
  TRACKS,
} from './tracks-catalog';

const topicsBySubject = new Map<string, string[]>();
for (const subjects of Object.values(TAXONOMY)) {
  for (const [subject, topics] of Object.entries(subjects)) {
    topicsBySubject.set(
      subject,
      topics.map(([name]) => name),
    );
  }
}

describe('catálogo das trilhas', () => {
  it('toda matéria da taxonomia tem trilha, menos as sem questões', () => {
    const comTrilha = TRACKS.map((t) => t.subject).sort();
    const esperadas = [...topicsBySubject.keys()]
      .filter((s) => !SUBJECTS_WITHOUT_TRACK.includes(s))
      .sort();
    expect(comTrilha).toEqual(esperadas);
  });

  it('uma trilha por matéria', () => {
    const nomes = TRACKS.map((t) => t.subject);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  describe.each(TRACKS.map((t) => [t.subject, t] as const))(
    '%s',
    (_, track) => {
      const taxonomia = topicsBySubject.get(track.subject) ?? [];
      const citados = [
        ...track.stages.flatMap((s) => s.topics),
        ...track.extras,
      ];

      it('cita cada assunto da matéria exatamente uma vez', () => {
        expect([...citados].sort()).toEqual([...taxonomia].sort());
      });

      it('tem etapas com 1 a 4 assuntos e títulos distintos', () => {
        expect(track.stages.length).toBeGreaterThan(0);
        for (const s of track.stages) {
          expect(s.topics.length).toBeGreaterThan(0);
          expect(s.topics.length).toBeLessThanOrEqual(MAX_TOPICS_PER_STAGE);
        }
        const titulos = track.stages.map((s) => s.title);
        expect(new Set(titulos).size).toBe(titulos.length);
      });

      // Datas históricas podem; contagem de questão não, porque a incidência
      // vem do banco e mudaria a cada prova importada.
      it('o porquê é curto, sem travessão, sem contagem de questões e sem ponto final', () => {
        for (const s of track.stages) {
          expect(s.why.length).toBeLessThanOrEqual(MAX_WHY_LENGTH);
          expect(s.why).not.toMatch(/[—–]/);
          expect(s.why).not.toMatch(/\d\s*quest|por prova|%/i);
          expect(s.why).not.toMatch(/\.$/);
          expect(s.title).not.toMatch(/[—–]/);
        }
      });
    },
  );

  it('os assuntos de língua existem na taxonomia de Língua Estrangeira', () => {
    const le = topicsBySubject.get('Língua Estrangeira') ?? [];
    for (const nome of Object.keys(LANGUAGE_TOPICS)) {
      expect(le).toContain(nome);
    }
  });
});
