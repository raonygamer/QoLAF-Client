// Extracted from official astroflux.js, server 1410.
// SHA256 0dd2468978a7ec1c5c889fa8c95e5b82bd09cd092903792f4ecb13fa82677d59.
// Native geometry/draw logic only; tests supply display/GPU boundary doubles.
export default function createBeamClasses(
  starling_display_Image,
  starling_display_MeshBatch,
  core_weapon_Weapon,
  textures_TextureLocator,
  openfl_geom_Point,
) {
  const $hxClasses = {};
  const $extend = (base, fields) => Object.assign(Object.create(base ?? null), fields);
  var core_hud_components_Line = function (e) {
    (null == e && (e = 'line1'), (this.toY = NaN), (this.toX = NaN), (this.overlap = !1));
    var t = textures_TextureLocator.getService();
    starling_display_Image.call(this, t.getTextureMainByTextureName(e));
  };
  (($hxClasses['core.hud.components.Line'] = core_hud_components_Line),
    (core_hud_components_Line.__name__ = 'core.hud.components.Line'),
    (core_hud_components_Line.__super__ = starling_display_Image),
    (core_hud_components_Line.prototype = $extend(starling_display_Image.prototype, {
      overlap: null,
      toX: null,
      toY: null,
      oldTextureName: null,
      init: function (e, t, i, s, n) {
        if (
          (null == n && (n = !1),
          null == s && (s = 1),
          null == i && (i = 16777215),
          null == t && (t = 1),
          null == e && (e = 'line1'),
          this.oldTextureName != e)
        ) {
          var a = textures_TextureLocator.getService();
          (this.set_texture(a.getTextureMainByTextureName(e)),
            this.readjustSize(this.get_texture().get_width(), this.get_texture().get_height()),
            this.set_pivotY(this.get_texture().get_height() / 2));
        }
        ((this.oldTextureName = e),
          this.set_color(i),
          this.set_alpha(s),
          (this.overlap = n),
          this.set_thickness(t),
          this.set_touchable(!0),
          this.set_visible(!0));
      },
      lineTo: function (e, t) {
        ((this.toX = e), (this.toY = t));
        var i = e - this.get_x(),
          s = t - this.get_y(),
          n = Math.sqrt(i * i + s * s);
        0 != n &&
          (this.set_rotation(0),
          this.set_width(this.overlap ? n + this.get_height() : n),
          this.set_rotation(Math.atan2(s, i)));
      },
      set_thickness: function (e) {
        var t = this.get_rotation();
        return (this.set_rotation(0), this.set_height(e), this.set_rotation(t), e);
      },
      dispose: function () {
        starling_display_Image.prototype.dispose.call(this);
      },
      __class__: core_hud_components_Line,
      __properties__: $extend(starling_display_Image.prototype.__properties__, {
        set_thickness: 'set_thickness',
      }),
    })));
  var core_hud_components_BeamLine = function (e) {
    ((this.lines = []),
      (this._color = 0),
      (this.glowColor = NaN),
      (this.glowWidth = NaN),
      (this.ampFactor = NaN),
      (this.amplitude = NaN),
      (this.thickness = NaN),
      (this.nodeFrequence = 0),
      (this.period = 100),
      starling_display_MeshBatch.call(this),
      (this.g = e));
  };
  (($hxClasses['core.hud.components.BeamLine'] = core_hud_components_BeamLine),
    (core_hud_components_BeamLine.__name__ = 'core.hud.components.BeamLine'),
    (core_hud_components_BeamLine.__super__ = starling_display_MeshBatch),
    (core_hud_components_BeamLine.prototype = $extend(starling_display_MeshBatch.prototype, {
      period: null,
      nodeFrequence: null,
      thickness: null,
      amplitude: null,
      ampFactor: null,
      glowWidth: null,
      glowColor: null,
      _color: null,
      lineTexture: null,
      lines: null,
      g: null,
      init: function (e, t, i, s, n, a, r, o) {
        (null == o && (o = 'line2'),
          null == r && (r = 16711680),
          null == a && (a = 3),
          null == n && (n = 1),
          null == s && (s = 16777215),
          null == i && (i = 2),
          null == t && (t = 3),
          null == e && (e = 3),
          (this.thickness = 2 * e),
          (this.nodeFrequence = t),
          (this.amplitude = i),
          this.set_alpha(n),
          (this.glowWidth = a),
          (this.glowColor = r),
          (this.lineTexture = o),
          this.set_blendMode('add'),
          (this._color = s),
          this.set_touchable(!0));
      },
      lineTo: function (e, t, i) {
        null == i && (i = 1);
        var s,
          n,
          a = e - this.get_x(),
          r = t - this.get_y(),
          o = a * a + r * r,
          _ = Math.sqrt(o),
          l = Math.round((_ / this.period) * this.nodeFrequence);
        if ((0 == l && (l = 1), l > this.lines.length))
          for (var h = 0, c = (l - this.lines.length) | 0; h < c; ) {
            h++;
            ((n = this.g.linePool.getLine()).init(
              this.lineTexture,
              0 | this.thickness,
              this.get_color(),
              1,
              !0,
            ),
              n.set_blendMode('add'),
              this.lines.push(n));
          }
        else if (l < this.lines.length) {
          for (s = 0 | l; s < this.lines.length; ) (this.g.linePool.removeLine(this.lines[s]), ++s);
          var u = this.lines,
            d = 0 | l;
          u.length > d ? u.splice(d, u.length - d) : (u[d - 1] = null);
        }
        starling_display_MeshBatch.prototype.clear.call(this);
        var p = 0,
          g = 0;
        for (s = 0; s < this.lines.length; ) {
          var f = this.lines[s],
            m = 2 - 2 * Math.abs((l / 2 - s) / l);
          (f.set_x(p), f.set_y(g));
          var y = (s + 1) / l;
          ((p = a * y + (this.amplitude - Math.random() * this.amplitude * 2) * m),
            (g = r * y + (this.amplitude - Math.random() * this.amplitude * 2) * m),
            s == l - 1 && ((p = a), (g = r)),
            f.lineTo(p, g),
            f.set_thickness(this.thickness + i),
            this.addMesh(f),
            ++s);
        }
      },
      set_touchable: function (e) {
        for (var t = 0; t < this.lines.length; ) {
          (this.lines[0].set_touchable(e), ++t);
        }
        return (starling_display_MeshBatch.prototype.set_touchable.call(this, e), e);
      },
      clear: function () {
        starling_display_MeshBatch.prototype.clear.call(this);
        for (var e = 0; e < this.lines.length; ) (this.g.linePool.removeLine(this.lines[e]), ++e);
        var t = this.lines;
        t.length > 0 ? t.splice(0, t.length) : (t[-1] = null);
      },
      set_color: function (e) {
        for (var t = 0; t < this.lines.length; ) {
          (this.lines[t].set_color(e), ++t);
        }
        return ((this._color = e), e);
      },
      get_color: function () {
        return this._color;
      },
      __class__: core_hud_components_BeamLine,
    })));
  var core_weapon_Beam = function (e) {
    ((this.effectsInitialized = !1),
      (this.twinOffset = 0),
      (this.twin = !1),
      (this.lastDamaged = 0),
      (this.chargeUpExpire = 2e3),
      (this.chargeUpNext = 8),
      (this.chargeUpCounter = 0),
      (this.chargeUPCurrent = 0),
      (this.chargeUpMax = 0),
      (this.drawBeam = !1),
      (this.oldDrawBeam = !1),
      (this.glowColor = 16711680),
      (this.beamNodes = 0),
      (this.beams = 3),
      (this.beamAlpha = 1),
      (this.startBeamAlpha = 1),
      (this.beamThickness = 1),
      (this.beamAmplitude = 2),
      (this.beamColor = 16777215),
      (this.secondaryTargets = []),
      (this.nrTargets = 0),
      (this.ready = !1),
      (this.lineBatch = new starling_display_MeshBatch()),
      (this.lines = []),
      (this.lastPos = new openfl_geom_Point()),
      (this.endPos = new openfl_geom_Point()),
      (this.startPos2 = new openfl_geom_Point()),
      (this.startPos = new openfl_geom_Point()),
      (this.endEffect = []),
      (this.startEffect2 = []),
      (this.startEffect = []),
      core_weapon_Weapon.call(this, e),
      this.lineBatch.set_blendMode('add'));
  };
  (($hxClasses['core.weapon.Beam'] = core_weapon_Beam),
    (core_weapon_Beam.__name__ = 'core.weapon.Beam'),
    (core_weapon_Beam.__super__ = core_weapon_Weapon),
    (core_weapon_Beam.prototype = $extend(core_weapon_Weapon.prototype, {
      startEffect: null,
      startEffect2: null,
      endEffect: null,
      startPos: null,
      startPos2: null,
      endPos: null,
      lastPos: null,
      lines: null,
      lineBatch: null,
      ready: null,
      nrTargets: null,
      secondaryTargets: null,
      beamColor: null,
      beamAmplitude: null,
      beamThickness: null,
      startBeamAlpha: null,
      beamAlpha: null,
      beams: null,
      beamNodes: null,
      glowColor: null,
      oldDrawBeam: null,
      drawBeam: null,
      targetBody: null,
      chargeUpMax: null,
      chargeUPCurrent: null,
      chargeUpCounter: null,
      chargeUpNext: null,
      chargeUpExpire: null,
      lastDamaged: null,
      twin: null,
      twinOffset: null,
      obj: null,
      init: function (e, t, i, s) {
        if (
          (null == s && (s = ''),
          null == i && (i = -1),
          core_weapon_Weapon.prototype.init.call(this, e, t, i, s),
          (this.obj = e),
          (this.drawBeam = !1),
          Object.prototype.hasOwnProperty.call(e, 'nrTargets')
            ? (this.nrTargets = e.nrTargets)
            : (this.nrTargets = 1),
          Object.prototype.hasOwnProperty.call(e, 'chargeUp')
            ? (this.chargeUpMax = e.chargeUp)
            : (this.chargeUpMax = 0),
          Object.prototype.hasOwnProperty.call(e, 'twin') &&
            ((this.twin = e.twin), (this.twinOffset = e.twinOffset)),
          (this.beamNodes = e.beamNodes),
          t > 0)
        )
          for (var n, a = 0, r = t; a < r; ) {
            var o = a++;
            ((n = e.techLevels[o]).incInterval,
              Object.prototype.hasOwnProperty.call(n, 'incNrTargets') &&
                (this.nrTargets += n.incNrTargets),
              Object.prototype.hasOwnProperty.call(n, 'incChargeUp') &&
                (this.chargeUpMax += n.incChargeUp),
              o == t - 1 &&
                ((this.beamColor = n.beamColor),
                (this.beams = n.beams),
                (this.beamAmplitude = n.beamAmplitude),
                (this.beamThickness = n.beamThickness),
                (this.beamAlpha = n.beamAlpha),
                (this.startBeamAlpha = this.beamAlpha),
                (this.glowColor = n.glowColor)));
          }
        else
          ((this.beamColor = e.beamColor),
            (this.beams = e.beams),
            (this.beamAmplitude = e.beamAmplitude),
            (this.beamThickness = e.beamThickness),
            (this.beamAlpha = e.beamAlpha),
            (this.startBeamAlpha = this.beamAlpha),
            (this.glowColor = e.glowColor));
        this.ready = !0;
      },
      effectsInitialized: null,
      initEffects: function () {
        ((this.startEffect = core_particle_EmitterFactory.create(
          this.obj.fireEffect,
          this.g,
          0,
          0,
          null,
          !1,
        )),
          null == this.startEffect && (this.startEffect = []),
          (this.endEffect = core_particle_EmitterFactory.create(
            this.obj.hitEffect,
            this.g,
            0,
            0,
            null,
            !1,
          )),
          null == this.endEffect && (this.endEffect = []));
        for (var e = 0, t = this.beams, i = 0, s = this.nrTargets; i < s; ) {
          i++;
          ((e += t <= 0 ? 1 : t), --t);
        }
        this.twin &&
          ((this.startEffect2 = core_particle_EmitterFactory.create(
            this.obj.fireEffect,
            this.g,
            0,
            0,
            null,
            !1,
          )),
          null == this.startEffect2 && (this.startEffect2 = []),
          (e *= 2));
        for (i = 0, s = e; i < s; ) {
          i++;
          var n = this.g.beamLinePool.getLine();
          (n.init(
            this.beamThickness,
            0 | this.beamNodes,
            this.beamAmplitude,
            this.beamColor,
            this.beamAlpha,
            4,
            this.glowColor,
          ),
            this.lines.push(n));
        }
        this.effectsInitialized = !0;
      },
      destroy: function () {
        for (var e = 0, t = this.startEffect; e < t.length; ) {
          var i = t[e];
          (++e, (i.alive = !1));
        }
        if (this.twin)
          for (e = 0, t = this.startEffect2; e < t.length; ) {
            i = t[e];
            (++e, (i.alive = !1));
          }
        for (e = 0, t = this.endEffect; e < t.length; ) {
          var s = t[e];
          (++e, (s.alive = !1));
        }
        (this.set_fire(!1),
          (this.effectsInitialized = !1),
          this.lineBatch.clear(),
          this.g.canvasEffects.removeChild(this.lineBatch),
          core_weapon_Weapon.prototype.destroy.call(this));
      },
      shoot: function () {
        if ((this.effectsInitialized || this.initEffects(), null == this.targetBody)) {
          if (
            (this.g.time - this.lastDamaged > this.chargeUpExpire && (this.chargeUPCurrent = 0),
            this.drawBeam && !this.oldDrawBeam)
          )
            if (
              null != this.fireSound &&
              this.g.camera.isCircleOnScreen(
                this.unit.get_x(),
                this.unit.get_y(),
                this.unit.get_radius(),
              )
            )
              sound_SoundLocator.getService().play(this.fireSound);
          this.oldDrawBeam = this.drawBeam;
          var e = this.unit.weaponPos.y + this.positionOffsetY,
            t = this.unit.weaponPos.x + this.positionOffsetX,
            i = Math.sqrt(t * t + e * e),
            s = Math.atan2(e, t);
          if (this.unit.forcedRotation)
            if (this.twin) {
              var n = this.unit.get_x();
              this.startPos.x =
                n +
                Math.cos(s + this.unit.forcedRotationAngle) * i +
                Math.cos(s + this.unit.forcedRotationAngle + 0.5 * Math.PI) * this.twinOffset;
              n = this.unit.get_y();
              this.startPos.y =
                n +
                Math.sin(s + this.unit.forcedRotationAngle) * i +
                Math.sin(s + this.unit.forcedRotationAngle + 0.5 * Math.PI) * this.twinOffset;
              n = this.unit.get_x();
              this.startPos2.x =
                n +
                Math.cos(s + this.unit.forcedRotationAngle) * i +
                Math.cos(s + this.unit.forcedRotationAngle - 0.5 * Math.PI) * this.twinOffset;
              n = this.unit.get_y();
              this.startPos2.y =
                n +
                Math.sin(s + this.unit.forcedRotationAngle) * i +
                Math.sin(s + this.unit.forcedRotationAngle - 0.5 * Math.PI) * this.twinOffset;
            } else {
              n = this.unit.get_x();
              this.startPos.x = n + Math.cos(s + this.unit.forcedRotationAngle) * i;
              n = this.unit.get_y();
              this.startPos.y = n + Math.sin(s + this.unit.forcedRotationAngle) * i;
            }
          else if (this.twin) {
            n = this.unit.get_x() + Math.cos(this.unit.get_rotation() + s) * i;
            var a = this.unit.get_rotation() + s;
            this.startPos.x = n + Math.cos(a + 0.5 * Math.PI) * this.twinOffset;
            ((n = this.unit.get_y() + Math.sin(this.unit.get_rotation() + s) * i),
              (a = this.unit.get_rotation() + s));
            this.startPos.y = n + Math.sin(a + 0.5 * Math.PI) * this.twinOffset;
            ((n = this.unit.get_x() + Math.cos(this.unit.get_rotation() + s) * i),
              (a = this.unit.get_rotation() + s));
            this.startPos2.x = n + Math.cos(a - 0.5 * Math.PI) * this.twinOffset;
            ((n = this.unit.get_y() + Math.sin(this.unit.get_rotation() + s) * i),
              (a = this.unit.get_rotation() + s));
            this.startPos2.y = n + Math.sin(a - 0.5 * Math.PI) * this.twinOffset;
          } else {
            ((n = this.unit.get_x()), (a = Math.cos(this.unit.get_rotation() + s) * i));
            this.startPos.x = n + a;
            ((n = this.unit.get_y()), (a = Math.sin(this.unit.get_rotation() + s) * i));
            this.startPos.y = n + a;
          }
          this.updateTargetOrder();
          for (var r = this.unit.get_rotation(), o = 0, _ = this.startEffect; o < _.length; ) {
            var l = _[o];
            (++o, (l.posX = this.startPos.x), (l.posY = this.startPos.y), (l.angle = r));
          }
          if (this.twin)
            for (o = 0, _ = this.startEffect2; o < _.length; ) {
              l = _[o];
              (++o, (l.posX = this.startPos2.x), (l.posY = this.startPos2.y), (l.angle = r));
            }
          if (null == this.target || !this.target.alive) {
            ((this.chargeUpCounter = 0),
              (this.target = null),
              (this.beamAlpha = this.startBeamAlpha / 3));
            ((n = this.unit.get_x()), (a = Math.cos(this.unit.get_rotation() + s) * this.range));
            this.endPos.x = n + a;
            ((n = this.unit.get_y()), (a = Math.sin(this.unit.get_rotation() + s) * this.range));
            this.endPos.y = n + a;
            for (o = 0, _ = this.endEffect; o < _.length; ) {
              var h = _[o];
              (++o, (h.posX = this.endPos.x), (h.posY = this.endPos.y), (h.angle = r - Math.PI));
            }
            return ((this.drawBeam = !0), void this.updateEmitters());
          }
          ((this.beamAlpha = this.startBeamAlpha), (this.lastDamaged = this.g.time));
          for (var c = 8; this.fireNextTime < this.g.time && c-- > 0; ) {
            if (this.unit instanceof core_ship_PlayerShip) {
              var u;
              try {
                u = js_Boot.__cast(this.unit, core_ship_PlayerShip);
              } catch (o) {
                ((haxe_NativeStackTrace.lastError = o), (u = null));
              }
              if (!u.weaponHeat.canFire(this.heatCost))
                return void (this.fireNextTime += this.reloadTime);
            }
            (0 == this.lastFire || 0 == this.fireNextTime
              ? (this.fireNextTime = this.g.time + this.reloadTime - 33)
              : (this.fireNextTime += this.reloadTime),
              (this.lastFire = this.g.time),
              this.chargeUpCounter++,
              this.chargeUpCounter > this.chargeUpNext &&
                this.chargeUPCurrent < this.chargeUpMax &&
                ((this.chargeUpCounter = 0), this.chargeUPCurrent++));
          }
          ((this.endPos.x = this.target.get_pos().x), (this.endPos.y = this.target.get_pos().y));
          var d = this.endPos.x - this.startPos.x,
            p = this.endPos.y - this.startPos.y;
          r = Math.atan2(p, d);
          for (o = 0, _ = this.endEffect; o < _.length; ) {
            h = _[o];
            (++o, (h.posX = this.endPos.x), (h.posY = this.endPos.y), (h.angle = r - Math.PI));
          }
          ((this.drawBeam = !0), this.updateEmitters());
        }
      },
      updateTargetOrder: function () {
        if (null == this.target || !this.target.alive)
          for (; this.secondaryTargets.length > 0; ) {
            var e = this.secondaryTargets[0];
            if ((this.secondaryTargets.splice(0, 1), e.alive)) return void (this.target = e);
          }
      },
      updateEmitters: function () {
        if (this.drawBeam != this.oldDrawBeam)
          if (this.drawBeam) {
            for (var e = 0, t = this.lines; e < t.length; ) {
              var i = t[e];
              (++e, this.lineBatch.addMesh(i));
            }
            this.g.canvasEffects.addChild(this.lineBatch);
            for (e = 0, t = this.endEffect; e < t.length; ) {
              var s = t[e];
              (++e, s.play());
            }
          } else {
            (this.lineBatch.clear(), this.g.canvasEffects.removeChild(this.lineBatch));
            for (e = 0, t = this.endEffect; e < t.length; ) {
              var n = t[e];
              (++e, n.stop());
            }
          }
      },
      fireAtBody: function (e) {
        var t = 0;
        if (((this.targetBody = e), null == e))
          return ((this.drawBeam = !1), this.set_fire(!1), void this.updateEmitters());
        ((this.oldDrawBeam = this.drawBeam), (t = this.unit.get_rotation()));
        var i = this.unit.weaponPos.y,
          s = this.unit.weaponPos.x,
          n = Math.sqrt(s * s + i * i),
          a = Math.atan2(i, s),
          r = this.unit.get_x(),
          o = Math.cos(this.unit.get_rotation() + a + this.unit.forcedRotationAngle) * n;
        this.startPos.x = r + o;
        ((r = this.unit.get_y()),
          (o = Math.sin(this.unit.get_rotation() + a + this.unit.forcedRotationAngle) * n));
        this.startPos.y = r + o;
        for (var _ = 0, l = this.startEffect; _ < l.length; ) {
          var h = l[_];
          (++_, (h.posX = this.startPos.x), (h.posY = this.startPos.y), (h.angle = t));
        }
        ((this.endPos.x = e.get_pos().x), (this.endPos.y = e.get_pos().y), (this.drawBeam = !0));
        var c = this.endPos.x - this.startPos.x,
          u = this.endPos.y - this.startPos.y;
        ((n =
          (n = Math.sqrt(c * c + u * u)) > 0.6 * e.get_radius()
            ? (n - 0.6 * e.get_radius()) / n
            : (0.6 * n) / n),
          (this.endPos.x = this.startPos.x + c * n),
          (this.endPos.y = this.startPos.y + u * n),
          (t = Math.atan2(u, c)));
        for (_ = 0, l = this.endEffect; _ < l.length; ) {
          var d = l[_];
          (++_, (d.posX = this.endPos.x), (d.posY = this.endPos.y), (d.angle = t - Math.PI));
        }
        this.updateEmitters();
      },
      drawBeamEffect: function (e, t, i, s) {
        var n = i.x - t.x,
          a = i.y - t.y,
          r = (n * n + a * a) | 0;
        if (r < 1 || r > 144e4 || this.lines.length < 1 || this.lines.length - 1 < e) return e + 1;
        for (var o = 0, _ = 0, l = s; _ < l; ) {
          _++;
          o =
            this.chargeUpMax > 0
              ? (this.chargeUPCurrent / this.chargeUpMax) * this.beamThickness
              : 0;
          var h = this.lines[e];
          (h.set_x(t.x), h.set_y(t.y), h.lineTo(i.x, i.y, o), h.set_visible(!0), ++e);
        }
        return e;
      },
      draw: function () {
        if (this.drawBeam) {
          var e,
            t = 0;
          if (null != this.g.get_me().ship) {
            var i = this.g.get_me().ship.weaponHeat;
            (t = (i.get_heat() / i.get_max()) * 1.5) > 1 && (t = 1);
          }
          t < 0.3 && (t = 0.3);
          for (var s = 0; s < this.lines.length; )
            ((e = this.lines[s]).set_alpha(t * this.beamAlpha), e.set_visible(!1), ++s);
          (this.twin
            ? ((s = this.drawBeamEffect(0, this.startPos, this.endPos, this.beams)),
              (s = this.drawBeamEffect(s, this.startPos2, this.endPos, this.beams)))
            : (s = this.drawBeamEffect(0, this.startPos, this.endPos, this.beams)),
            (this.lastPos.x = this.endPos.x),
            (this.lastPos.y = this.endPos.y));
          for (var n = this.beams, a = 0; a < this.secondaryTargets.length; ) {
            var r = this.secondaryTargets[a];
            (r.alive &&
              (n > 1 && --n,
              (s = this.drawBeamEffect(s, this.lastPos, r.get_pos(), n)),
              (this.lastPos.x = r.get_pos().x),
              (this.lastPos.y = r.get_pos().y)),
              ++a);
          }
          for (this.lineBatch.clear(), s = 0; s < this.lines.length; )
            ((e = this.lines[s]).get_visible() && this.lineBatch.addMesh(this.lines[s]), ++s);
          this.lineBatch.set_alpha(t * this.beamAlpha);
        }
      },
      set_fire: function (e) {
        if (null != this.targetBody || e == this._fire) return e;
        if (((this._fire = e), (this.lastFire = 0), 1 == this._fire)) {
          for (var t = 0, i = this.startEffect; t < i.length; ) {
            var s = i[t];
            (++t, s.play());
          }
          if (this.twin)
            for (t = 0, i = this.startEffect2; t < i.length; ) {
              s = i[t];
              (++t, s.play());
            }
        } else {
          ((this.drawBeam = !1),
            this.lineBatch.clear(),
            this.g.canvasEffects.removeChild(this.lineBatch));
          for (t = 0, i = this.lines; t < i.length; ) {
            var n = i[t];
            (++t, n.clear());
          }
          for (t = 0, i = this.startEffect; t < i.length; ) {
            var a = i[t];
            (++t, a.stop());
          }
          if (this.twin)
            for (t = 0, i = this.startEffect2; t < i.length; ) {
              a = i[t];
              (++t, a.stop());
            }
          for (t = 0, i = this.endEffect; t < i.length; ) {
            var r = i[t];
            (++t, r.stop());
          }
        }
        return e;
      },
      __class__: core_weapon_Beam,
    })));
  return {
    Line: core_hud_components_Line,
    BeamLine: core_hud_components_BeamLine,
    Beam: core_weapon_Beam,
  };
}
