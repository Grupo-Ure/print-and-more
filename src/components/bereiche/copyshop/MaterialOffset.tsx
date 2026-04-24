import type { ReactNode } from 'react'
import type { CopyShopDetailJson } from '../../../types/copyshop'
import '../../WorkArea.css'

export type MatOffProps = {
  d: CopyShopDetailJson
  fe: (k: string) => string
  f: Record<string, string>
  pruef: boolean
  patchL: (p: CopyShopDetailJson) => void
  commit: () => void
  speichDetail: (d: CopyShopDetailJson) => void
}

function BerZeile({
  l,
  e,
  children,
}: {
  l: string
  e?: string
  children: ReactNode
}) {
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{l}</span>
      <div>
        {children}
        {e && <p className="ber-err">{e}</p>}
      </div>
    </div>
  )
}

export function MaterialOffset(p: MatOffProps) {
  const { d, fe, f, pruef, patchL, commit, speichDetail } = p
  const r = d as Record<string, string | null | undefined>
  const oa = String(r.offset_art ?? '')

  const onArtChange = (v: string) => {
    const base: CopyShopDetailJson = {
      ...d,
      offset_art: v || null,
      offset_grammatur: null,
      offset_oberflaeche: null,
      spezial_papier: null,
      spezial_sonstige: null,
      kaschierung: null,
      kaschierung_seiten: null,
      recycling_grammatur: null,
    } as CopyShopDetailJson
    speichDetail(base)
  }

  return (
    <>
      <BerZeile l="Offset-Art" e={pruef && f.offset_art ? f.offset_art : undefined}>
        <select
          className={'ber-inp' + fe('offset_art')}
          value={oa}
          onChange={e => onArtChange(e.target.value)}
        >
          <option value="">—</option>
          <option value="STANDARD">Standard</option>
          <option value="OFFSET">Offset</option>
          <option value="SPEZIAL">Spezial</option>
        </select>
      </BerZeile>

      {oa === 'STANDARD' && (
        <>
          <BerZeile
            l="Grammatur"
            e={pruef && f.offset_grammatur ? f.offset_grammatur : undefined}
          >
            <select
              className={'ber-inp' + fe('offset_grammatur')}
              value={String(r.offset_grammatur ?? '')}
              onChange={e =>
                speichDetail({ ...d, offset_grammatur: e.target.value } as CopyShopDetailJson)
              }
            >
              <option value="">—</option>
              {(['115G', '135G', '170G', '250G', '300G', '350G', '400G'] as const).map(x => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </BerZeile>
          <BerZeile
            l="Oberfläche"
            e={pruef && f.offset_oberflaeche ? f.offset_oberflaeche : undefined}
          >
            <select
              className={'ber-inp' + fe('offset_oberflaeche')}
              value={String(r.offset_oberflaeche ?? '')}
              onChange={e =>
                speichDetail({ ...d, offset_oberflaeche: e.target.value } as CopyShopDetailJson)
              }
            >
              <option value="">—</option>
              <option value="MATT">Matt</option>
              <option value="GLAENZEND">Glänzend</option>
            </select>
          </BerZeile>
        </>
      )}

      {oa === 'OFFSET' && (
        <BerZeile
          l="Grammatur"
          e={pruef && f.offset_grammatur ? f.offset_grammatur : undefined}
        >
          <select
            className={'ber-inp' + fe('offset_grammatur')}
            value={String(r.offset_grammatur ?? '')}
            onChange={e =>
              speichDetail({ ...d, offset_grammatur: e.target.value } as CopyShopDetailJson)
            }
          >
            <option value="">—</option>
            {(['80G', '90G', '100G', '120G', '150G', '250G'] as const).map(x => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </BerZeile>
      )}

      {oa === 'SPEZIAL' && (
        <>
          <BerZeile
            l="Papier"
            e={pruef && f.spezial_papier ? f.spezial_papier : undefined}
          >
            <select
              className={'ber-inp' + fe('spezial_papier')}
              value={String(r.spezial_papier ?? '')}
              onChange={e => {
                const v = e.target.value
                speichDetail({
                  ...d,
                  spezial_papier: v,
                  spezial_sonstige: v === 'SONSTIGE' ? (r.spezial_sonstige ?? null) : null,
                  kaschierung: null,
                  kaschierung_seiten: null,
                  recycling_grammatur: null,
                } as CopyShopDetailJson)
              }}
            >
              <option value="">—</option>
              <option value="300G_FOLIENKASCHIERT">300g folienkaschiert</option>
              <option value="RECYCLING">Recycling</option>
              <option value="250G_LEINENSTRUKTUR">250g Leinenstruktur</option>
              <option value="SONSTIGE">Sonstige</option>
            </select>
          </BerZeile>
          {r.spezial_papier === '300G_FOLIENKASCHIERT' && (
            <>
              <BerZeile
                l="Kaschierung"
                e={pruef && f.kaschierung ? f.kaschierung : undefined}
              >
                <select
                  className={'ber-inp' + fe('kaschierung')}
                  value={String(r.kaschierung ?? '')}
                  onChange={e =>
                    speichDetail({ ...d, kaschierung: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="MATT">Matt</option>
                  <option value="GLAENZEND">Glänzend</option>
                </select>
              </BerZeile>
              <BerZeile
                l="Seiten"
                e={pruef && f.kaschierung_seiten ? f.kaschierung_seiten : undefined}
              >
                <select
                  className={'ber-inp' + fe('kaschierung_seiten')}
                  value={String(r.kaschierung_seiten ?? '')}
                  onChange={e =>
                    speichDetail({ ...d, kaschierung_seiten: e.target.value } as CopyShopDetailJson)
                  }
                >
                  <option value="">—</option>
                  <option value="EINSEITIG">Einseitig</option>
                  <option value="BEIDSEITIG">Beidseitig</option>
                </select>
              </BerZeile>
            </>
          )}
          {r.spezial_papier === 'RECYCLING' && (
            <BerZeile
              l="Grammatur"
              e={pruef && f.recycling_grammatur ? f.recycling_grammatur : undefined}
            >
              <select
                className={'ber-inp' + fe('recycling_grammatur')}
                value={String(r.recycling_grammatur ?? '')}
                onChange={e =>
                  speichDetail({ ...d, recycling_grammatur: e.target.value } as CopyShopDetailJson)
                }
              >
                <option value="">—</option>
                {(['80G', '135G', '150G', '300G'] as const).map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </BerZeile>
          )}
          {r.spezial_papier === 'SONSTIGE' && (
            <BerZeile
              l="Papier (sonstige)"
              e={pruef && f.spezial_sonstige ? f.spezial_sonstige : undefined}
            >
              <textarea
                className={'ber-inp ber-ta' + fe('spezial_sonstige')}
                rows={2}
                value={String(r.spezial_sonstige ?? '')}
                onChange={e => patchL({ spezial_sonstige: e.target.value } as CopyShopDetailJson)}
                onBlur={commit}
              />
            </BerZeile>
          )}
        </>
      )}
    </>
  )
}
