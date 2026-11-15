// Account esterni alla scuola ammessi come alunni (collaboratori che mandano foto e proposte).
// email: chi entra con Google (login.html?ospite=1); invito: impronta SHA-256 del link personale
// (/api/invito?t=...). Il link vero non sta qui, perché il repository è pubblico: per toglierlo basta cancellare la riga.
module.exports = [
  { email: 'alecoc85@gmail.com', nome: 'Collaboratore', invito: 'e829f11e33dec076057f4d8986444a28b4f972831404a282eb4e847a2ef212ec' },
];
