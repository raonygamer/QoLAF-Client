// Captured from astroflux build 564; native method body preserved unchanged.
export const hasWeaponInFleet = function (t) {
  for (var e = 0, i = this.g.get_me().fleet; e < i.length; ) {
    var s = i[e];
    ++e;
    for (var n = 0, r = s.weapons; n < r.length; ) {
      var a = r[n];
      if ((++n, a.weapon == t)) return !0;
    }
  }
  return !1;
};
