// Account esterni alla scuola ammessi come alunni (collaboratori che mandano foto e proposte).
// email: chi entra con Google (login.html?ospite=1); invito: impronta SHA-256 del link personale
// (/api/invito?t=...). Il link vero non sta qui, perché il repository è pubblico: per toglierlo basta cancellare la riga.
module.exports = [
  { email: 'alecoc85@gmail.com', nome: 'Collaboratore', invito: '9c6bd499139d3ac013ba00cb198a24b85f13d98df2e8738366eb7ac84f7f0e9c' },
];
