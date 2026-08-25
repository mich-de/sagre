/* ---------------------------------------------------------------------------
 * Come si chiama questo foglio. Stava scritto a mano in cinque posti — testata
 * dello schermo, testata della carta, insegna della home, nome del calendario
 * che si scarica, firma dentro il file .ics — con cinque rese diverse, e la
 * sesta volta che cambiava uno restava indietro.
 *
 * Il nome e il dove stanno separati perché non vanno sempre insieme: nella
 * testata appiccicata in alto il dove sta su una riga sua e si accorcia quando
 * lo schermo è stretto, in un file .ics ci vuole tutto in fila su una riga.
 * ------------------------------------------------------------------------- */

/** L'insegna. La «&» è quella del manifesto, non una «e» scritta comoda. */
export const SITE_NAME = 'Eventi & Sagre'

/** Dove. Minuscolo, perché è un pezzo di frase e non un titolo a sé: chi lo
 *  vuole in stampatello lo mette in stampatello col CSS. */
export const SITE_WHERE = 'penisola sorrentina e dintorni'

/** Il pezzo che si può lasciare fuori quando lo schermo è stretto: «penisola
 *  sorrentina» da sola dice già dove siamo, «e dintorni» è la precisione che
 *  serve solo se c'è posto. */
export const SITE_WHERE_SHORT = 'penisola sorrentina'
export const SITE_WHERE_REST = ' e dintorni'

/** Tutto in fila, per dove non si può andare a capo: il nome del calendario che
 *  finisce nell'agenda del telefono, la firma dentro il file .ics. */
export const SITE_TITLE = `${SITE_NAME} in ${SITE_WHERE}`
