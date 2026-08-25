import { describe, expect, it } from "bun:test";
import {
  aliasBrand,
  aliasProject,
  isCountMetric,
  maskProject,
  scaleCount,
} from "@helm/domain";

// Bu dosya "kritik mantik" testi: buradaki bir regresyon SESSIZ olur.
// Yanlis bir isCountMetric yuzdeyi 10 ile carpar (%995), determinist olmayan
// bir takma ad ise ayni projeye iki ekranda iki farkli ad verir - ikisi de
// ancak ekran goruntusu paylasildiktan SONRA fark edilir.

describe("aliasProject", () => {
  it("ayni girdi icin her zaman ayni cikti", () => {
    const a = aliasProject("Block Forge");
    for (let i = 0; i < 50; i++) expect(aliasProject("Block Forge")).toBe(a);
  });

  it("farkli projeler farkli ad alir", () => {
    const names = ["Block Forge", "Echo", "Helm", "Dante", "Nimbus Run"];
    const aliases = new Set(names.map(aliasProject));
    expect(aliases.size).toBe(names.length);
  });

  it("gercek adi sizdirmaz", () => {
    const alias = aliasProject("Block Forge");
    expect(alias.toLowerCase()).not.toContain("block");
    expect(alias.toLowerCase()).not.toContain("forge");
  });

  it("marka ve proje ayni girdide bile farkli ad alir", () => {
    expect(aliasBrand("Wesan")).not.toBe(aliasProject("Wesan"));
  });
});

describe("maskProject", () => {
  it("kapaliyken aynen gecirir", () => {
    expect(maskProject("Block Forge", false)).toBe("Block Forge");
  });

  it("null korunur - 'ad yok' bir bilgi, uydurulmaz", () => {
    expect(maskProject(null, true)).toBeNull();
    expect(maskProject("", true)).toBe("");
  });
});

describe("isCountMetric", () => {
  it("sayaclar", () => {
    for (const m of ["dau", "mau", "total_users", "new_users", "active_subs"]) {
      expect(isCountMetric(m)).toBe(true);
    }
  });

  it("para metrikleri DISARIDA - format katmani zaten carpiyor, cift olurdu", () => {
    for (const m of ["mrr", "ad_revenue", "app_revenue", "iap_revenue"]) {
      expect(isCountMetric(m)).toBe(false);
    }
  });

  it("oran ve sure DISARIDA", () => {
    for (const m of ["crash_free_sessions", "avg_session_sec", "retention_d1"]) {
      expect(isCountMetric(m)).toBe(false);
    }
  });
});

describe("scaleCount", () => {
  it("null korunur - null 'olcum yok', 0 'olculdu ve sifir'", () => {
    expect(scaleCount(null, 10)).toBeNull();
  });

  it("carpan 1 iken referans degismez", () => {
    expect(scaleCount(1234, 1)).toBe(1234);
  });

  it("tam sayiya yuvarlar", () => {
    expect(scaleCount(1234, 2.5)).toBe(3085);
    expect(Number.isInteger(scaleCount(7, 1.3))).toBe(true);
  });

  it("sifir sifir kalir", () => {
    expect(scaleCount(0, 50)).toBe(0);
  });
});
