// Everything the traveller says lives here. Edit this file when the CV changes.
//
// stops: the road, in order. The first stop is the camp, where every lap starts and ends.
//   sign:  the year painted on the signpost (digits plus the letters the pixel font knows)
//   title, when: the dialog header
//   text:  the dialog body; plain HTML, links allowed
//   back:  (camp only) what the camp says when you ride back to it
// The scenery at each stop, and where it sits on the map, is set by its position in this list
// (see SCENES and WHERE in caravan.js).
//
// writing: extra entries listed at the bottom of the journal.
window.STORY = {
  stops: [
    { sign: '', title: 'Camp', when: 'tonight',
      text: 'Hi, I\'m Mohamad, a machine learning engineer. Pull up a seat by the fire. Click and we\'ll ride through the road so far, or <a href="#" data-journal>read the journal</a>.',
      back: 'And we\'re back at the fire. Building something with LLMs that has to survive production? <a href="mailto:mohahf19@gmail.com">Write to me</a>. Click to ride again, or <a href="#" data-journal>read the journal</a>.' },
    { sign: '2017', title: 'Bilkent University', when: 'Ankara, 2017–2021', text: 'Computer engineering, with mathematics as a second major. Top 3% of my class, and first in maths.' },
    { sign: '2020', title: 'Çiçek Lab', when: 'Ankara, 2020', text: 'Interpretable machine learning for genomics. My first paper, published in <a href="https://doi.org/10.1093/bioinformatics/btab803" target="_blank" rel="noopener">Bioinformatics</a>.' },
    { sign: '2021', title: 'Near Space Labs', when: 'Barcelona, 2021–2022', text: 'Deep learning on aerial imagery taken from high-altitude balloons. Automated checks for blur and clouds cut manual review by 83%.' },
    { sign: '2021', title: 'EPFL', when: 'Lausanne, 2021–2024', text: 'MSc in computer science, theory track. Thesis on curriculum learning for LLM pretraining with Martin Jaggi, graded 6/6.' },
    { sign: '2022', title: 'QuantCo', when: 'Zürich, 2022–now', text: 'Came as an intern, stayed as an ML engineer. A RAG assistant worth CHF 1M+ a year, agents serving 5,000 requests a day, and the backend of an AI underwriting system that reads documents for a living.' },
    { sign: '2026', title: 'Research', when: 'under review', text: 'Two optimisation papers submitted to AISTATS 2027: RanSOM, and a hybrid-momentum Frank–Wolfe method. Both are about getting to the bottom of the curve faster. <a href="#" data-lens>Look through the telescope</a>.' },
  ],
  writing: [
    { when: '2021', title: 'Bioinformatics paper', text: 'Uncovering complementary sets of variants for predicting quantitative phenotypes, with Serhan Yilmaz, Mehmet Koyutürk, A. Ercüment Çiçek and Öznur Taştan. <a href="https://doi.org/10.1093/bioinformatics/btab803" target="_blank" rel="noopener">Read it</a>.' },
    { when: '2020', title: 'HIBIT 2020 poster', text: 'Potpourri: an epistasis test prioritization algorithm via diverse SNP selection.' },
    { when: '2020', title: 'Deep learning write-up', text: 'Deep learning introduction and applications, from summer research with Prof. Gökhan Yıldırım.' },
  ],
};
