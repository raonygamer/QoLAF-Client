import type { createClientSettings } from '../ported/ClientSettings';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type { Game, GameClasses } from './Game';

// Type names denote instances; value names denote their constructors/statics.
// Haxe registers these after this plugin module is imported, so live bindings
// are assigned at classesReady rather than constructing wrapper/proxy classes.
export type AIStateMachine = Game.core.states.StateMachine;
export let AIStateMachine: GameClasses['core.states.StateMachine'];
export type AITeleport = Game.core.states.aistates.AITeleport;
export let AITeleport: GameClasses['core.states.aistates.AITeleport'];
export type ShipWarpJump = Game.core.states.ship.WarpJump;
export let ShipWarpJump: GameClasses['core.states.ship.WarpJump'];
export type AIStateFactory = Game.core.states.aistates.AIStateFactory;
export let AIStateFactory: GameClasses['core.states.aistates.AIStateFactory'];
export type Box = Game.core.hud.components.Box;
export let Box: GameClasses['core.hud.components.Box'];
export type CrewDisplayBox = Game.core.hud.components.CrewDisplayBox;
export let CrewDisplayBox: GameClasses['core.hud.components.CrewDisplayBox'];
export type ExploreArea = Game.core.hud.components.explore.ExploreArea;
export let ExploreArea: GameClasses['core.hud.components.explore.ExploreArea'];
export type ExploreMap = Game.core.hud.components.explore.ExploreMap;
export let ExploreMap: GameClasses['core.hud.components.explore.ExploreMap'];
export type ExploreState = Game.core.states.exploreStates.ExploreState;
export let ExploreState: GameClasses['core.states.exploreStates.ExploreState'];
export type SceneStateMachine = Game.core.states.SceneStateMachine;
export let SceneStateMachine: GameClasses['core.states.SceneStateMachine'];
export type Radar = Game.core.hud.components.radar.Radar;
export let Radar: GameClasses['core.hud.components.radar.Radar'];
export type RadarBlip = Game.core.hud.components.radar.Blip;
export let RadarBlip: GameClasses['core.hud.components.radar.Blip'];
export type Polygon = Game.starling.geom.Polygon;
export let Polygon: GameClasses['starling.geom.Polygon'];
export type StarlingButton = Game.starling.display.Button;
export let StarlingButton: GameClasses['starling.display.Button'];
export type ShopItemBar = Game.core.hud.components.ShopItemBar;
export let ShopItemBar: GameClasses['core.hud.components.ShopItemBar'];
export type CreditBuyBox = Game.core.hud.components.dialogs.CreditBuyBox;
export let CreditBuyBox: GameClasses['core.hud.components.dialogs.CreditBuyBox'];
export type CreditManager = Game.core.credits.CreditManager;
export let CreditManager: GameClasses['core.credits.CreditManager'];
export type Hud = Game.core.hud.Hud;
export let Hud: GameClasses['core.hud.Hud'];
export type TechTree = Game.core.hud.components.techTree.TechTree;
export let TechTree: GameClasses['core.hud.components.techTree.TechTree'];
export type EliteTechPopupMenu = Game.core.hud.components.techTree.EliteTechPopupMenu;
export let EliteTechPopupMenu: GameClasses['core.hud.components.techTree.EliteTechPopupMenu'];
export type EliteTechIcon = Game.core.hud.components.techTree.EliteTechIcon;
export let EliteTechIcon: GameClasses['core.hud.components.techTree.EliteTechIcon'];
export type TechLevelIcon = Game.core.hud.components.techTree.TechLevelIcon;
export let TechLevelIcon: GameClasses['core.hud.components.techTree.TechLevelIcon'];
export type MapPlayer = Game.core.hud.components.map.MapPlayer;
export let MapPlayer: GameClasses['core.hud.components.map.MapPlayer'];
export type MapDeathLine = Game.core.hud.components.map.MapDeathLine;
export let MapDeathLine: GameClasses['core.hud.components.map.MapDeathLine'];
export type PowerBar = Game.core.hud.components.PowerBar;
export let PowerBar: GameClasses['core.hud.components.PowerBar'];
export type TechBar = Game.core.hud.components.techTree.TechBar;
export let TechBar: GameClasses['core.hud.components.techTree.TechBar'];
export type PlayerClanLogo = Game.core.clan.PlayerClanLogo;
export let PlayerClanLogo: GameClasses['core.clan.PlayerClanLogo'];
export type ClanClient = Game.core.clan.ClanClient;
export let ClanClient: GameClasses['core.clan.ClanClient'];
export type PvpManager = Game.core.hud.components.pvp.PvpManager;
export let PvpManager: GameClasses['core.hud.components.pvp.PvpManager'];
export type DominationManager = Game.core.hud.components.pvp.DominationManager;
export let DominationManager: GameClasses['core.hud.components.pvp.DominationManager'];
export type Drop = Game.core.drops.Drop;
export let Drop: GameClasses['core.drops.Drop'];
export type InstantState = Game.core.states.aistates.Instant;
export let InstantState: GameClasses['core.states.aistates.Instant'];
export type InstantSplitting = Game.core.states.aistates.InstantSplitting;
export let InstantSplitting: GameClasses['core.states.aistates.InstantSplitting'];
export type PressButton = Game.core.hud.components.ui.PressButton;
export let PressButton: GameClasses['core.hud.components.ui.PressButton'];
export type ShipFactory = Game.core.ship.ShipFactory;
export let ShipFactory: GameClasses['core.ship.ShipFactory'];
export type PodState = Game.core.states.gameStates.PodState;
export let PodState: GameClasses['core.states.gameStates.PodState'];
export type SkinItem = Game.core.hud.components.hangar.SkinItem;
export let SkinItem: GameClasses['core.hud.components.hangar.SkinItem'];
export type SkinItemBaseStats = Game.core.hud.components.hangar.SkinItemBaseStats;
export let SkinItemBaseStats: GameClasses['core.hud.components.hangar.SkinItemBaseStats'];
export type MenuSelectIcon = Game.core.hud.components.shipMenu.MenuSelectIcon;
export let MenuSelectIcon: GameClasses['core.hud.components.shipMenu.MenuSelectIcon'];
export type CreditPackageItem = Game.core.hud.components.credits.CreditPackageItem;
export let CreditPackageItem: GameClasses['core.hud.components.credits.CreditPackageItem'];
export type ArtifactStat = Game.core.artifact.ArtifactStat;
export let ArtifactStat: GameClasses['core.artifact.ArtifactStat'];
export type ArtifactBox = Game.core.artifact.ArtifactBox;
export let ArtifactBox: GameClasses['core.artifact.ArtifactBox'];
export type Cargo = Game.core.hud.components.cargo.Cargo;
export let Cargo: GameClasses['core.hud.components.cargo.Cargo'];
export type ArtifactSelector = Game.core.hud.components.shipMenu.ArtifactSelector;
export let ArtifactSelector: GameClasses['core.hud.components.shipMenu.ArtifactSelector'];
export type PopupBuyMessage = Game.core.hud.components.dialogs.PopupBuyMessage;
export let PopupBuyMessage: GameClasses['core.hud.components.dialogs.PopupBuyMessage'];
export type ArtifactCargoBox = Game.core.artifact.ArtifactCargoBox;
export let ArtifactCargoBox: GameClasses['core.artifact.ArtifactCargoBox'];
export type ArtifactState2 = Game.core.states.menuStates.ArtifactState2;
export let ArtifactState2: GameClasses['core.states.menuStates.ArtifactState2'];

export type DisplayState = Game.core.states.DisplayState;
export let DisplayState: GameClasses['core.states.DisplayState'];

export type MenuHud = Game.core.hud.MenuHud;
export let MenuHud: GameClasses['core.hud.MenuHud'];

export type ArtifactOverview = Game.core.artifact.ArtifactOverview;
export let ArtifactOverview: GameClasses['core.artifact.ArtifactOverview'];
export type Artifact = Game.core.artifact.Artifact;
export let Artifact: GameClasses['core.artifact.Artifact'];
export type ArtifactFactory = Game.core.artifact.ArtifactFactory;
export let ArtifactFactory: GameClasses['core.artifact.ArtifactFactory'];
export type BuyFlux = Game.core.hud.components.credits.BuyFlux;
export let BuyFlux: GameClasses['core.hud.components.credits.BuyFlux'];
export type PayVault = Game.playerio.PayVault;
export let PayVault: GameClasses['playerio.PayVault'];
export type StarlingCameraFocus = Game.camerafocus.StarlingCameraFocus;
export let StarlingCameraFocus: GameClasses['camerafocus.StarlingCameraFocus'];
export type Point = Game.openfl.geom.Point;
export let Point: GameClasses['openfl.geom.Point'];
export type Login = Game.Login;
export let Login: GameClasses['Login'];
export type Preload = Game.Preload;
export let Preload: GameClasses['Preload'];
export type LoadingBar = Game.LoadingBar;
export let LoadingBar: GameClasses['LoadingBar'];
export type JoinRoomManager = Game.joinRoom.JoinRoomManager;
export let JoinRoomManager: GameClasses['joinRoom.JoinRoomManager'];
export type JoinRoomLocator = Game.joinRoom.JoinRoomLocator;
export let JoinRoomLocator: GameClasses['joinRoom.JoinRoomLocator'];
export type RymdenRunt = Game.RymdenRunt;
export let RymdenRunt: GameClasses['RymdenRunt'];
export type Util = Game.generics.Util;
export let Util: GameClasses['generics.Util'];
export type EmbeddedAssets = Game.EmbeddedAssets;
export let EmbeddedAssets: GameClasses['EmbeddedAssets'];
export type DataManager = Game.data.DataManager;
export let DataManager: GameClasses['data.DataManager'];
export type DomOverlay = Game.core.hud.components.ui.DomOverlay;
export let DomOverlay: GameClasses['core.hud.components.ui.DomOverlay'];
export type ChatInputText = Game.core.hud.components.chat.ChatInputText;
export let ChatInputText: GameClasses['core.hud.components.chat.ChatInputText'];
export type DataLocator = Game.data.DataLocator;
export let DataLocator: GameClasses['data.DataLocator'];
export type InputText = Game.core.hud.components.InputText;
export let InputText: GameClasses['core.hud.components.InputText'];
export type TextEntry = Game.core.hud.components.ui.TextEntry;
export let TextEntry: GameClasses['core.hud.components.ui.TextEntry'];
export type TextBitmap = Game.core.hud.components.TextBitmap;
export let TextBitmap: GameClasses['core.hud.components.TextBitmap'];
export type Connection = Game.playerio.Connection;
export let Connection: GameClasses['playerio.Connection'];
export type Message = Game.playerio.Message;
export let Message: GameClasses['playerio.Message'];
export type PlayerIOError = Game.playerio.PlayerIOError;
export let PlayerIOError: GameClasses['playerio.PlayerIOError'];
export type PlayerIO = Game.playerio.PlayerIO;
export let PlayerIO: GameClasses['playerio.PlayerIO'];
export type RecoverDialog = Game.core.login.RecoverDialog;
export let RecoverDialog: GameClasses['core.login.RecoverDialog'];
export type ServiceRoomPreview = Game.core.login.ServiceRoomPreview;
export let ServiceRoomPreview: GameClasses['core.login.ServiceRoomPreview'];
export type ServiceRoomSelector = Game.core.login.ServiceRoomSelector;
export let ServiceRoomSelector: GameClasses['core.login.ServiceRoomSelector'];
export type TimerEvent = Game.openfl.events.TimerEvent;

export type NativeEvent = Game.openfl.events.Event;
export let NativeEvent: GameClasses['openfl.events.Event'];
export type NativeEventDispatcher = Game.openfl.events.EventDispatcher;
export let NativeEventDispatcher: GameClasses['openfl.events.EventDispatcher'];

export type Event = Game.starling.events.Event;
export let Event: GameClasses['starling.events.Event'];

export type RegisterDialog2 = Game.core.login.RegisterDialog2;
export let RegisterDialog2: GameClasses['core.login.RegisterDialog2'];
export type LoginButton = Game.core.hud.components.LoginButton;
export let LoginButton: GameClasses['core.hud.components.LoginButton'];
export type LoginInput = Game.core.hud.components.LoginInput;
export let LoginInput: GameClasses['core.hud.components.LoginInput'];
export type Client = Game.playerio.Client;
export let Client: GameClasses['playerio.Client'];
export type PlayerIORegistrationError = Game.playerio.PlayerIORegistrationError;
export let PlayerIORegistrationError: GameClasses['playerio.PlayerIORegistrationError'];
export type Localize = Game.generics.Localize;
export let Localize: GameClasses['generics.Localize'];
export type DisplayObjectContainer = Game.starling.display.DisplayObjectContainer;
export let DisplayObjectContainer: GameClasses['starling.display.DisplayObjectContainer'];

export type StarlingStage = Game.starling.display.Stage;
export let StarlingStage: GameClasses['starling.display.Stage'];

export type Starling = Game.starling.core.Starling;
export let Starling: GameClasses['starling.core.Starling'];

export type QuickConnect = Game.playerio.QuickConnect;
export let QuickConnect: GameClasses['playerio.QuickConnect'];
export type PlayerIOSDK = Game.playerio.sdk.PlayerIOSdk;
export let PlayerIOSDK: GameClasses['playerio.sdk.PlayerIOSdk'];

export type GameScene = Game.core.scene.Game;
export let GameScene: GameClasses['core.scene.Game'];
export type PlayerManager = Game.core.player.PlayerManager;
export let PlayerManager: GameClasses['core.player.PlayerManager'];

export type TextHandler = Game.core.text.TextHandler;
export let TextHandler: GameClasses['core.text.TextHandler'];

export type TextParticle = Game.core.text.TextParticle;
export let TextParticle: GameClasses['core.text.TextParticle'];

export type TextManager = Game.core.text.TextManager;
export let TextManager: GameClasses['core.text.TextManager'];

export type MessagePackHandler = Game.core.sync.MessagePackHandler;
export let MessagePackHandler: GameClasses['core.sync.MessagePackHandler'];
export type ShipSync = Game.core.ship.ShipSync;
export let ShipSync: GameClasses['core.ship.ShipSync'];

export type Weapon = Game.core.weapon.Weapon;
export let Weapon: GameClasses['core.weapon.Weapon'];

export type Beam = Game.core.weapon.Beam;
export let Beam: GameClasses['core.weapon.Beam'];
export type DailyRewardMessage = Game.core.hud.components.dialogs.DailyRewardMessage;
export let DailyRewardMessage: GameClasses['core.hud.components.dialogs.DailyRewardMessage'];
export type DailyRewardChild = Game.core.hud.components.dialogs.DailyRewardChild;
export let DailyRewardChild: GameClasses['core.hud.components.dialogs.DailyRewardChild'];
export type Damage = Game.core.weapon.Damage;
export let Damage: GameClasses['core.weapon.Damage'];
export type Unit = Game.core.unit.Unit;
export let Unit: GameClasses['core.unit.Unit'];

export type Quad = Game.starling.display.Quad;
export let Quad: GameClasses['starling.display.Quad'];

export type NativeTextFormat = Game.openfl.text.TextFormat;
export let NativeTextFormat: GameClasses['openfl.text.TextFormat'];

export type BitmapChar = Game.starling.text.BitmapChar;
export let BitmapChar: GameClasses['starling.text.BitmapChar'];
export type BitmapFont = Game.starling.text.BitmapFont;
export let BitmapFont: GameClasses['starling.text.BitmapFont'];

export type TextFormat = Game.starling.text.TextFormat;
export let TextFormat: GameClasses['starling.text.TextFormat'];

export type StarlingTextField = Game.starling.text.TextField;
export let StarlingTextField: GameClasses['starling.text.TextField'];

export type SceneBase = Game.core.scene.SceneBase;
export type ClientSettings = InstanceType<ReturnType<typeof createClientSettings>>;
export let SceneBase: GameClasses['core.scene.SceneBase'] & { clientSettings?: ClientSettings };

export type WeaponSelector = Game.core.hud.components.shipMenu.WeaponSelector;
export let WeaponSelector: GameClasses['core.hud.components.shipMenu.WeaponSelector'];
export type HealthAndShield = Game.core.hud.components.HealthAndShield;
export let HealthAndShield: GameClasses['core.hud.components.HealthAndShield'];
export type MessageLog = Game.core.hud.components.chat.MessageLog;
export let MessageLog: GameClasses['core.hud.components.chat.MessageLog'];

export type FadeScreen = Game.core.hud.components.FadeScreen;
export let FadeScreen: GameClasses['core.hud.components.FadeScreen'];

export type TopPvPPlayersList = Game.core.hud.components.TopPvPPlayersList;
export let TopPvPPlayersList: GameClasses['core.hud.components.TopPvPPlayersList'];

export type Room = Game.joinRoom.Room;
export let Room: GameClasses['joinRoom.Room'];

export type GUID = Game.generics.GUID;
export let GUID: GameClasses['generics.GUID'];

export type StartSetup = Game.startSetup.StartSetup;
export let StartSetup: GameClasses['startSetup.StartSetup'];

export type Player = Game.core.player.Player;
export let Player: GameClasses['core.player.Player'];
export type MD5 = Game.com.adobe.crypto.MD5;
export let MD5: GameClasses['com.adobe.crypto.MD5'];
export type RoomInfo = Game.playerio.RoomInfo;

export type GameStateMachine = Game.core.states.GameStateMachine;
export let GameStateMachine: GameClasses['core.states.GameStateMachine'];

export type Missile = Game.core.states.aistates.Missile;
export let Missile: GameClasses['core.states.aistates.Missile'];
export type Boomerang = Game.core.states.aistates.Boomerang;
export let Boomerang: GameClasses['core.states.aistates.Boomerang'];
export type MissileStuck = Game.core.states.aistates.MissileStuck;
export let MissileStuck: GameClasses['core.states.aistates.MissileStuck'];
export type ProjectileStuck = Game.core.states.aistates.ProjectileStuck;
export let ProjectileStuck: GameClasses['core.states.aistates.ProjectileStuck'];
export type ProjectileFactory = Game.core.projectile.ProjectileFactory;
export let ProjectileFactory: GameClasses['core.projectile.ProjectileFactory'];
export type ProjectileManager = Game.core.projectile.ProjectileManager;
export let ProjectileManager: GameClasses['core.projectile.ProjectileManager'];
export type Heading = Game.movement.Heading;
export let Heading: GameClasses['movement.Heading'];
export type Ship = Game.core.ship.Ship;
export let Ship: GameClasses['core.ship.Ship'];
export type ProjectileBullet = Game.core.states.aistates.ProjectileBullet;
export let ProjectileBullet: GameClasses['core.states.aistates.ProjectileBullet'];
export type Bouncing = Game.core.states.aistates.Bouncing;
export let Bouncing: GameClasses['core.states.aistates.Bouncing'];
export type RibbonTrail = Game.extensions.RibbonTrail;
export let RibbonTrail: GameClasses['extensions.RibbonTrail'];
export type RibbonSegment = Game.extensions.RibbonSegment;
export let RibbonSegment: GameClasses['extensions.RibbonSegment'];
export type RibbonTrailPool = Game.core.pools.RibbonTrailPool;
export let RibbonTrailPool: GameClasses['core.pools.RibbonTrailPool'];
export type Emitter = Game.core.particle.Emitter;
export let Emitter: GameClasses['core.particle.Emitter'];
export type Particle = Game.core.particle.Particle;
export let Particle: GameClasses['core.particle.Particle'];
export type Color = Game.generics.Color;
export let Color: GameClasses['generics.Color'];
export type EmitterManager = Game.core.particle.EmitterManager;
export let EmitterManager: GameClasses['core.particle.EmitterManager'];
export type CollectiveMeshBatch = Game.core.particle.CollectiveMeshBatch;
export let CollectiveMeshBatch: GameClasses['core.particle.CollectiveMeshBatch'];
export type StarMap = Game.core.hud.components.map.Map;
export let StarMap: GameClasses['core.hud.components.map.Map'];

export type GameObject = Game.core.GameObject;
export let GameObject: GameClasses['core.GameObject'];
export type Engine = Game.core.engine.Engine;
export let Engine: GameClasses['core.engine.Engine'];
export type BodyManager = Game.core.solarSystem.BodyManager;
export let BodyManager: GameClasses['core.solarSystem.BodyManager'];

export type Body = Game.core.solarSystem.Body;
export let Body: GameClasses['core.solarSystem.Body'];
export type PlayerListItem = Game.core.hud.components.playerList.PlayerListItem;
export let PlayerListItem: GameClasses['core.hud.components.playerList.PlayerListItem'];
export type BossFactory = Game.core.boss.BossFactory;
export let BossFactory: GameClasses['core.boss.BossFactory'];
export type BossComponent = Game.core.boss.BossComponent;
export let BossComponent: GameClasses['core.boss.BossComponent'];
export type Boss = Game.core.boss.Boss;
export let Boss: GameClasses['core.boss.Boss'];
export type Spawner = Game.core.spawner.Spawner;
export let Spawner: GameClasses['core.spawner.Spawner'];

export type BossManager = Game.core.boss.BossManager;
export let BossManager: GameClasses['core.boss.BossManager'];

export type SpawnManager = Game.core.spawner.SpawnManager;
export let SpawnManager: GameClasses['core.spawner.SpawnManager'];

export type ShipManager = Game.core.ship.ShipManager;
export let ShipManager: GameClasses['core.ship.ShipManager'];
export type AIResurect = Game.core.states.aistates.AIResurect;
export let AIResurect: GameClasses['core.states.aistates.AIResurect'];
export type EnemyShip = Game.core.ship.EnemyShip;
export let EnemyShip: GameClasses['core.ship.EnemyShip'];
export type EmitterFactory = Game.core.particle.EmitterFactory;
export let EmitterFactory: GameClasses['core.particle.EmitterFactory'];
export type PlayerShip = Game.core.ship.PlayerShip;
export let PlayerShip: GameClasses['core.ship.PlayerShip'];
export type Projectile = Game.core.projectile.Projectile;
export let Projectile: GameClasses['core.projectile.Projectile'];

export type ToolTip = Game.core.hud.components.ToolTip;
export let ToolTip: GameClasses['core.hud.components.ToolTip'];
export type WrapText = Game.core.hud.components.ui.WrapText;
export let WrapText: GameClasses['core.hud.components.ui.WrapText'];
export type Style = Game.core.hud.components.Style;
export let Style: GameClasses['core.hud.components.Style'];

export type Command = Game.movement.Command;
export let Command: GameClasses['movement.Command'];

export type Converger = Game.core.sync.Converger;
export let Converger: GameClasses['core.sync.Converger'];

export type Clock = Game.clock.Clock;
export let Clock: GameClasses['clock.Clock'];

export type PlayState = Game.core.states.gameStates.PlayState;
export let PlayState: GameClasses['core.states.gameStates.PlayState'];

export type LandedHangar = Game.core.states.gameStates.LandedHangar;
export let LandedHangar: GameClasses['core.states.gameStates.LandedHangar'];
export type LandedLore = Game.core.states.gameStates.LandedLore;
export let LandedLore: GameClasses['core.states.gameStates.LandedLore'];

export type LandedExplore = Game.core.states.gameStates.LandedExplore;
export let LandedExplore: GameClasses['core.states.gameStates.LandedExplore'];
export type SelectTeamState = Game.core.states.exploreStates.SelectTeamState;
export let SelectTeamState: GameClasses['core.states.exploreStates.SelectTeamState'];
export type ReportState = Game.core.states.exploreStates.ReportState;
export let ReportState: GameClasses['core.states.exploreStates.ReportState'];
export type LandedPaintShop = Game.core.states.gameStates.LandedPaintShop;
export let LandedPaintShop: GameClasses['core.states.gameStates.LandedPaintShop'];
export type PaintButton = Game.core.hud.components.Button;
export let PaintButton: GameClasses['core.hud.components.Button'];
export type LandedState = Game.core.states.gameStates.LandedState;
export let LandedState: GameClasses['core.states.gameStates.LandedState'];

export type KilledPlayerState = Game.core.states.player.Killed;
export let KilledPlayerState: GameClasses['core.states.player.Killed'];

export type RoamingState = Game.core.states.gameStates.RoamingState;
export let RoamingState: GameClasses['core.states.gameStates.RoamingState'];

export type WarpJumpState = Game.core.states.gameStates.WarpJumpState;
export let WarpJumpState: GameClasses['core.states.gameStates.WarpJumpState'];

export type FragmentFilter = Game.starling.filters.FragmentFilter;
export let FragmentFilter: GameClasses['starling.filters.FragmentFilter'];
export type DisplayObject = Game.starling.display.DisplayObject;
export type MissionView = Game.core.states.gameStates.missions.MissionView;
export let MissionView: GameClasses['core.states.gameStates.missions.MissionView'];
export type ClanState = Game.core.states.gameStates.ClanState;
export let ClanState: GameClasses['core.states.gameStates.ClanState'];
export type DailyReward = Game.core.states.gameStates.missions.DailyReward;
export let DailyReward: GameClasses['core.states.gameStates.missions.DailyReward'];
export type DailyView = Game.core.states.gameStates.missions.DailyView;
export let DailyView: GameClasses['core.states.gameStates.missions.DailyView'];
export type DailyMission = Game.core.states.gameStates.missions.Daily;
export type DailyManager = Game.core.missions.DailyManager;
export let DailyManager: GameClasses['core.missions.DailyManager'];
export type MissionsList = Game.core.states.gameStates.missions.MissionsList;
export let MissionsList: GameClasses['core.states.gameStates.missions.MissionsList'];
export type IntroState = Game.core.states.gameStates.IntroState;
export let IntroState: GameClasses['core.states.gameStates.IntroState'];
export type ScreenTextField = Game.core.hud.components.ScreenTextField;
export let ScreenTextField: GameClasses['core.hud.components.ScreenTextField'];
export type BlurFilter = Game.starling.filters.BlurFilter;
export let BlurFilter: GameClasses['starling.filters.BlurFilter'];
export type ColorMatrixFilter = Game.starling.filters.ColorMatrixFilter;
export let ColorMatrixFilter: GameClasses['starling.filters.ColorMatrixFilter'];
export type TouchEvent = Game.starling.events.TouchEvent;

export type GlowFilter = Game.starling.filters.GlowFilter;
export let GlowFilter: GameClasses['starling.filters.GlowFilter'];
export type ProjectileGun = Game.core.weapon.ProjectileGun;
export let ProjectileGun: GameClasses['core.weapon.ProjectileGun'];
export type Teleport = Game.core.weapon.Teleport;
export let Teleport: GameClasses['core.weapon.Teleport'];
export type TweenMax = Game.com.greensock.TweenMax;
export let TweenMax: GameClasses['com.greensock.TweenMax'];

export type Mesh = Game.starling.display.Mesh;
export let Mesh: GameClasses['starling.display.Mesh'];
export type MeshBatch = Game.starling.display.MeshBatch;
export let MeshBatch: GameClasses['starling.display.MeshBatch'];
export type VertexData = Game.starling.rendering.VertexData;
export let VertexData: GameClasses['starling.rendering.VertexData'];
export type IndexData = Game.starling.rendering.IndexData;
export let IndexData: GameClasses['starling.rendering.IndexData'];
export type Text = Game.core.hud.components.Text;
export let Text: GameClasses['core.hud.components.Text'];

export type MovieClip = Game.starling.display.MovieClip;
export let MovieClip: GameClasses['starling.display.MovieClip'];

export type Sprite = Game.starling.display.Sprite;
export let Sprite: GameClasses['starling.display.Sprite'];
export type ParallaxManager = Game.core.parallax.ParallaxManager;
export let ParallaxManager: GameClasses['core.parallax.ParallaxManager'];

export type TextureManager = Game.textures.TextureManager;
export let TextureManager: GameClasses['textures.TextureManager'];
export type TextureAtlas = Game.starling.textures.TextureAtlas;
export let TextureAtlas: GameClasses['starling.textures.TextureAtlas'];
export type Texture = Game.starling.textures.Texture;
export let Texture: GameClasses['starling.textures.Texture'];

export type TextureLocator = Game.textures.TextureLocator;
export let TextureLocator: GameClasses['textures.TextureLocator'];
export type Image = Game.starling.display.Image;
export let Image: GameClasses['starling.display.Image'];
export type Random = Game.generics.Random;
export let Random: GameClasses['generics.Random'];

export type BitmapData = Game.openfl.display.BitmapData;
export let BitmapData: GameClasses['openfl.display.BitmapData'];

export type Shape = Game.openfl.display.Shape;
export let Shape: GameClasses['openfl.display.Shape'];

export type Rectangle = Game.openfl.geom.Rectangle;
export let Rectangle: GameClasses['openfl.geom.Rectangle'];

export type Matrix = Game.openfl.geom.Matrix;
export let Matrix: GameClasses['openfl.geom.Matrix'];

export type Bitmap = Game.openfl.display.Bitmap;
export let Bitmap: GameClasses['openfl.display.Bitmap'];
export type ImageLoader = Game.openfl.display.Loader;
export let ImageLoader: GameClasses['openfl.display.Loader'];
export type URLLoader = Game.openfl.net.URLLoader;
export let URLLoader: GameClasses['openfl.net.URLLoader'];
export type Sound = Game.openfl.media.Sound;
export let Sound: GameClasses['openfl.media.Sound'];
export type SoundChannel = Game.openfl.media.SoundChannel;
export let SoundChannel: GameClasses['openfl.media.SoundChannel'];
export type SoundTransform = Game.openfl.media.SoundTransform;
export let SoundTransform: GameClasses['openfl.media.SoundTransform'];
export type URLRequest = Game.openfl.net.URLRequest;
export let URLRequest: GameClasses['openfl.net.URLRequest'];
export type LoaderContext = Game.openfl.system.LoaderContext;
export let LoaderContext: GameClasses['openfl.system.LoaderContext'];
export type Xml = Game.Xml;
export let Xml: GameClasses['Xml'];

export type PopupConfirmMessage = Game.core.hud.components.dialogs.PopupConfirmMessage;
export let PopupConfirmMessage: GameClasses['core.hud.components.dialogs.PopupConfirmMessage'];
export type PopupMessage = Game.core.hud.components.dialogs.PopupMessage;
export let PopupMessage: GameClasses['core.hud.components.dialogs.PopupMessage'];

export type PlayerList = Game.core.hud.components.playerList.PlayerList;
export let PlayerList: GameClasses['core.hud.components.playerList.PlayerList'];

export type FriendManager = Game.core.friend.FriendManager;
export let FriendManager: GameClasses['core.friend.FriendManager'];
export type ButtonQueue = Game.core.hud.components.ButtonQueue;
export let ButtonQueue: GameClasses['core.hud.components.ButtonQueue'];
export type ButtonPvPQuickMatch = Game.core.hud.components.ButtonPvPQuickMatch;
export let ButtonPvPQuickMatch: GameClasses['core.hud.components.ButtonPvPQuickMatch'];
export type QueueManager = Game.core.queue.QueueManager;
export let QueueManager: GameClasses['core.queue.QueueManager'];
export type QueueInfoHolder = Game.core.queue.QueueInfoHolder;
export let QueueInfoHolder: GameClasses['core.queue.QueueInfoHolder'];

export type QueuePopupMessage = Game.core.hud.components.dialogs.QueuePopupMessage;
export let QueuePopupMessage: GameClasses['core.hud.components.dialogs.QueuePopupMessage'];
export type SoundManager = Game.sound.SoundManager;
export let SoundManager: GameClasses['sound.SoundManager'];
export type SoundObject = Game.sound.SoundObject;
export let SoundObject: GameClasses['sound.SoundObject'];
export type SoundLocator = Game.sound.SoundLocator;
export let SoundLocator: GameClasses['sound.SoundLocator'];

export type Turret = Game.core.turret.Turret;
export let Turret: GameClasses['core.turret.Turret'];
export type TurretManager = Game.core.turret.TurretManager;
export let TurretManager: GameClasses['core.turret.TurretManager'];
export type WeaponManager = Game.core.weapon.WeaponManager;
export let WeaponManager: GameClasses['core.weapon.WeaponManager'];

/** Resolve everything before publishing, so a missing class cannot half-bind. */
export function bindGameClasses(api: API): void {
  const reflection = new GameReflection(api);
  const resolved = {
    FragmentFilter: reflection.require('starling.filters.FragmentFilter'),
    PlayerListItem: reflection.require('core.hud.components.playerList.PlayerListItem'),
    BossFactory: reflection.require('core.boss.BossFactory'),
    BossComponent: reflection.require('core.boss.BossComponent'),
    Turret: reflection.require('core.turret.Turret'),
    TurretManager: reflection.require('core.turret.TurretManager'),
    WeaponManager: reflection.require('core.weapon.WeaponManager'),
    ServiceRoomPreview: reflection.require('core.login.ServiceRoomPreview'),
    ServiceRoomSelector: reflection.require('core.login.ServiceRoomSelector'),
    QueuePopupMessage: reflection.require('core.hud.components.dialogs.QueuePopupMessage'),
    SoundManager: reflection.require('sound.SoundManager'),
    SoundObject: reflection.require('sound.SoundObject'),
    SoundLocator: reflection.require('sound.SoundLocator'),

    PlayerList: reflection.require('core.hud.components.playerList.PlayerList'),
    FriendManager: reflection.require('core.friend.FriendManager'),
    ButtonQueue: reflection.require('core.hud.components.ButtonQueue'),
    ButtonPvPQuickMatch: reflection.require('core.hud.components.ButtonPvPQuickMatch'),
    QueueManager: reflection.require('core.queue.QueueManager'),
    QueueInfoHolder: reflection.require('core.queue.QueueInfoHolder'),

    PopupConfirmMessage: reflection.require('core.hud.components.dialogs.PopupConfirmMessage'),
    PopupMessage: reflection.require('core.hud.components.dialogs.PopupMessage'),
    Rectangle: reflection.require('openfl.geom.Rectangle'),
    BitmapFont: reflection.require('starling.text.BitmapFont'),
    BitmapChar: reflection.require('starling.text.BitmapChar'),
    BitmapData: reflection.require('openfl.display.BitmapData'),
    Shape: reflection.require('openfl.display.Shape'),
    Radar: reflection.require('core.hud.components.radar.Radar'),
    RadarBlip: reflection.require('core.hud.components.radar.Blip'),
    Polygon: reflection.require('starling.geom.Polygon'),
    StarlingButton: reflection.require('starling.display.Button'),
    ShopItemBar: reflection.require('core.hud.components.ShopItemBar'),
    CreditBuyBox: reflection.require('core.hud.components.dialogs.CreditBuyBox'),
    CreditManager: reflection.require('core.credits.CreditManager'),
    Hud: reflection.require('core.hud.Hud'),
    TechTree: reflection.require('core.hud.components.techTree.TechTree'),
    EliteTechPopupMenu: reflection.require('core.hud.components.techTree.EliteTechPopupMenu'),
    EliteTechIcon: reflection.require('core.hud.components.techTree.EliteTechIcon'),
    TechLevelIcon: reflection.require('core.hud.components.techTree.TechLevelIcon'),
    MapPlayer: reflection.require('core.hud.components.map.MapPlayer'),
    MapDeathLine: reflection.require('core.hud.components.map.MapDeathLine'),
    PowerBar: reflection.require('core.hud.components.PowerBar'),
    TechBar: reflection.require('core.hud.components.techTree.TechBar'),
    PlayerClanLogo: reflection.require('core.clan.PlayerClanLogo'),
    ClanClient: reflection.require('core.clan.ClanClient'),
    PvpManager: reflection.require('core.hud.components.pvp.PvpManager'),
    DominationManager: reflection.require('core.hud.components.pvp.DominationManager'),
    Drop: reflection.require('core.drops.Drop'),
    Matrix: reflection.require('openfl.geom.Matrix'),
    Bitmap: reflection.require('openfl.display.Bitmap'),
    ImageLoader: reflection.require('openfl.display.Loader'),
    URLLoader: reflection.require('openfl.net.URLLoader'),
    Sound: reflection.require('openfl.media.Sound'),
    SoundChannel: reflection.require('openfl.media.SoundChannel'),
    SoundTransform: reflection.require('openfl.media.SoundTransform'),
    URLRequest: reflection.require('openfl.net.URLRequest'),
    LoaderContext: reflection.require('openfl.system.LoaderContext'),
    Xml: reflection.require('Xml'),
    TextureAtlas: reflection.require('starling.textures.TextureAtlas'),
    Texture: reflection.require('starling.textures.Texture'),

    TextureLocator: reflection.require('textures.TextureLocator'),
    Image: reflection.require('starling.display.Image'),
    Random: reflection.require('generics.Random'),
    TextureManager: reflection.require('textures.TextureManager'),
    Mesh: reflection.require('starling.display.Mesh'),
    MeshBatch: reflection.require('starling.display.MeshBatch'),
    VertexData: reflection.require('starling.rendering.VertexData'),
    IndexData: reflection.require('starling.rendering.IndexData'),
    Text: reflection.require('core.hud.components.Text'),
    MovieClip: reflection.require('starling.display.MovieClip'),
    Sprite: reflection.require('starling.display.Sprite'),
    ParallaxManager: reflection.require('core.parallax.ParallaxManager'),
    MissionView: reflection.require('core.states.gameStates.missions.MissionView'),
    ClanState: reflection.require('core.states.gameStates.ClanState'),
    DailyReward: reflection.require('core.states.gameStates.missions.DailyReward'),
    DailyView: reflection.require('core.states.gameStates.missions.DailyView'),
    DailyManager: reflection.require('core.missions.DailyManager'),
    MissionsList: reflection.require('core.states.gameStates.missions.MissionsList'),
    IntroState: reflection.require('core.states.gameStates.IntroState'),
    ScreenTextField: reflection.require('core.hud.components.ScreenTextField'),
    BlurFilter: reflection.require('starling.filters.BlurFilter'),
    ColorMatrixFilter: reflection.require('starling.filters.ColorMatrixFilter'),
    GlowFilter: reflection.require('starling.filters.GlowFilter'),
    ProjectileGun: reflection.require('core.weapon.ProjectileGun'),
    Teleport: reflection.require('core.weapon.Teleport'),
    TweenMax: reflection.require('com.greensock.TweenMax'),
    WarpJumpState: reflection.require('core.states.gameStates.WarpJumpState'),
    KilledPlayerState: reflection.require('core.states.player.Killed'),
    RoamingState: reflection.require('core.states.gameStates.RoamingState'),
    PlayState: reflection.require('core.states.gameStates.PlayState'),
    LandedHangar: reflection.require('core.states.gameStates.LandedHangar'),
    LandedLore: reflection.require('core.states.gameStates.LandedLore'),
    LandedExplore: reflection.require('core.states.gameStates.LandedExplore'),
    SelectTeamState: reflection.require('core.states.exploreStates.SelectTeamState'),
    ReportState: reflection.require('core.states.exploreStates.ReportState'),
    LandedPaintShop: reflection.require('core.states.gameStates.LandedPaintShop'),
    PaintButton: reflection.require('core.hud.components.Button'),
    LandedState: reflection.require('core.states.gameStates.LandedState'),

    GameStateMachine: reflection.require('core.states.GameStateMachine'),
    Missile: reflection.require('core.states.aistates.Missile'),
    Boomerang: reflection.require('core.states.aistates.Boomerang'),
    MissileStuck: reflection.require('core.states.aistates.MissileStuck'),
    ProjectileStuck: reflection.require('core.states.aistates.ProjectileStuck'),
    ProjectileFactory: reflection.require('core.projectile.ProjectileFactory'),
    ProjectileManager: reflection.require('core.projectile.ProjectileManager'),
    Heading: reflection.require('movement.Heading'),
    Ship: reflection.require('core.ship.Ship'),
    ProjectileBullet: reflection.require('core.states.aistates.ProjectileBullet'),
    Bouncing: reflection.require('core.states.aistates.Bouncing'),
    Damage: reflection.require('core.weapon.Damage'),
    DailyRewardMessage: reflection.require('core.hud.components.dialogs.DailyRewardMessage'),
    DailyRewardChild: reflection.require('core.hud.components.dialogs.DailyRewardChild'),
    Beam: reflection.require('core.weapon.Beam'),
    RibbonTrail: reflection.require('extensions.RibbonTrail'),
    RibbonSegment: reflection.require('extensions.RibbonSegment'),
    RibbonTrailPool: reflection.require('core.pools.RibbonTrailPool'),
    Emitter: reflection.require('core.particle.Emitter'),
    Particle: reflection.require('core.particle.Particle'),
    Color: reflection.require('generics.Color'),
    EmitterManager: reflection.require('core.particle.EmitterManager'),
    CollectiveMeshBatch: reflection.require('core.particle.CollectiveMeshBatch'),
    StarMap: reflection.require('core.hud.components.map.Map'),
    GameObject: reflection.require('core.GameObject'),
    Engine: reflection.require('core.engine.Engine'),
    BodyManager: reflection.require('core.solarSystem.BodyManager'),
    Body: reflection.require('core.solarSystem.Body'),
    Boss: reflection.require('core.boss.Boss'),
    Spawner: reflection.require('core.spawner.Spawner'),
    BossManager: reflection.require('core.boss.BossManager'),
    SpawnManager: reflection.require('core.spawner.SpawnManager'),
    ShipManager: reflection.require('core.ship.ShipManager'),
    AIResurect: reflection.require('core.states.aistates.AIResurect'),
    EnemyShip: reflection.require('core.ship.EnemyShip'),
    EmitterFactory: reflection.require('core.particle.EmitterFactory'),
    PlayerShip: reflection.require('core.ship.PlayerShip'),
    Projectile: reflection.require('core.projectile.Projectile'),
    ToolTip: reflection.require('core.hud.components.ToolTip'),
    WrapText: reflection.require('core.hud.components.ui.WrapText'),
    Style: reflection.require('core.hud.components.Style'),
    Clock: reflection.require('clock.Clock'),
    InstantState: reflection.require('core.states.aistates.Instant'),
    InstantSplitting: reflection.require('core.states.aistates.InstantSplitting'),
    PressButton: reflection.require('core.hud.components.ui.PressButton'),
    ShipFactory: reflection.require('core.ship.ShipFactory'),
    PodState: reflection.require('core.states.gameStates.PodState'),
    SkinItem: reflection.require('core.hud.components.hangar.SkinItem'),
    SkinItemBaseStats: reflection.require('core.hud.components.hangar.SkinItemBaseStats'),
    MenuSelectIcon: reflection.require('core.hud.components.shipMenu.MenuSelectIcon'),
    CreditPackageItem: reflection.require('core.hud.components.credits.CreditPackageItem'),
    ArtifactStat: reflection.require('core.artifact.ArtifactStat'),
    ArtifactBox: reflection.require('core.artifact.ArtifactBox'),
    Cargo: reflection.require('core.hud.components.cargo.Cargo'),
    ArtifactSelector: reflection.require('core.hud.components.shipMenu.ArtifactSelector'),
    PopupBuyMessage: reflection.require('core.hud.components.dialogs.PopupBuyMessage'),
    ArtifactCargoBox: reflection.require('core.artifact.ArtifactCargoBox'),
    ArtifactState2: reflection.require('core.states.menuStates.ArtifactState2'),
    DisplayState: reflection.require('core.states.DisplayState'),
    MenuHud: reflection.require('core.hud.MenuHud'),
    ArtifactOverview: reflection.require('core.artifact.ArtifactOverview'),
    Artifact: reflection.require('core.artifact.Artifact'),
    ArtifactFactory: reflection.require('core.artifact.ArtifactFactory'),
    BuyFlux: reflection.require('core.hud.components.credits.BuyFlux'),
    PayVault: reflection.require('playerio.PayVault'),
    StarlingCameraFocus: reflection.require('camerafocus.StarlingCameraFocus'),
    Point: reflection.require('openfl.geom.Point'),
    Player: reflection.require('core.player.Player'),
    MD5: reflection.require('com.adobe.crypto.MD5'),
    Room: reflection.require('joinRoom.Room'),
    GUID: reflection.require('generics.GUID'),
    StartSetup: reflection.require('startSetup.StartSetup'),

    TopPvPPlayersList: reflection.require('core.hud.components.TopPvPPlayersList'),
    FadeScreen: reflection.require('core.hud.components.FadeScreen'),
    WeaponSelector: reflection.require('core.hud.components.shipMenu.WeaponSelector'),
    HealthAndShield: reflection.require('core.hud.components.HealthAndShield'),
    MessageLog: reflection.require('core.hud.components.chat.MessageLog'),
    SceneBase: reflection.require('core.scene.SceneBase'),
    TextFormat: reflection.require('starling.text.TextFormat'),
    StarlingTextField: reflection.require('starling.text.TextField'),
    NativeTextFormat: reflection.require('openfl.text.TextFormat'),
    Quad: reflection.require('starling.display.Quad'),
    Command: reflection.require('movement.Command'),
    Converger: reflection.require('core.sync.Converger'),
    MessagePackHandler: reflection.require('core.sync.MessagePackHandler'),
    ShipSync: reflection.require('core.ship.ShipSync'),
    Weapon: reflection.require('core.weapon.Weapon'),
    Unit: reflection.require('core.unit.Unit'),
    TextManager: reflection.require('core.text.TextManager'),
    TextParticle: reflection.require('core.text.TextParticle'),
    TextHandler: reflection.require('core.text.TextHandler'),
    SceneStateMachine: reflection.require('core.states.SceneStateMachine'),
    AIStateMachine: reflection.require('core.states.StateMachine'),
    AITeleport: reflection.require('core.states.aistates.AITeleport'),
    ShipWarpJump: reflection.require('core.states.ship.WarpJump'),
    AIStateFactory: reflection.require('core.states.aistates.AIStateFactory'),
    Box: reflection.require('core.hud.components.Box'),
    CrewDisplayBox: reflection.require('core.hud.components.CrewDisplayBox'),
    ExploreArea: reflection.require('core.hud.components.explore.ExploreArea'),
    ExploreMap: reflection.require('core.hud.components.explore.ExploreMap'),
    ExploreState: reflection.require('core.states.exploreStates.ExploreState'),
    GameScene: reflection.require('core.scene.Game'),
    PlayerManager: reflection.require('core.player.PlayerManager'),
    QuickConnect: reflection.require('playerio.QuickConnect'),
    PlayerIOSDK: reflection.require('playerio.sdk.PlayerIOSdk'),

    RegisterDialog2: reflection.require('core.login.RegisterDialog2'),
    LoginButton: reflection.require('core.hud.components.LoginButton'),
    LoginInput: reflection.require('core.hud.components.LoginInput'),
    Client: reflection.require('playerio.Client'),
    PlayerIORegistrationError: reflection.require('playerio.PlayerIORegistrationError'),
    Localize: reflection.require('generics.Localize'),
    DisplayObjectContainer: reflection.require('starling.display.DisplayObjectContainer'),
    StarlingStage: reflection.require('starling.display.Stage'),
    Starling: reflection.require('starling.core.Starling'),

    Login: reflection.require('Login'),
    Preload: reflection.require('Preload'),
    LoadingBar: reflection.require('LoadingBar'),
    JoinRoomManager: reflection.require('joinRoom.JoinRoomManager'),
    JoinRoomLocator: reflection.require('joinRoom.JoinRoomLocator'),
    RymdenRunt: reflection.require('RymdenRunt'),
    Util: reflection.require('generics.Util'),
    EmbeddedAssets: reflection.require('EmbeddedAssets'),
    DataManager: reflection.require('data.DataManager'),
    DomOverlay: reflection.require('core.hud.components.ui.DomOverlay'),
    ChatInputText: reflection.require('core.hud.components.chat.ChatInputText'),
    DataLocator: reflection.require('data.DataLocator'),
    InputText: reflection.require('core.hud.components.InputText'),
    TextEntry: reflection.require('core.hud.components.ui.TextEntry'),
    TextBitmap: reflection.require('core.hud.components.TextBitmap'),
    Connection: reflection.require('playerio.Connection'),
    Message: reflection.require('playerio.Message'),
    PlayerIOError: reflection.require('playerio.PlayerIOError'),
    PlayerIO: reflection.require('playerio.PlayerIO'),
    RecoverDialog: reflection.require('core.login.RecoverDialog'),
    NativeEvent: reflection.require('openfl.events.Event'),
    NativeEventDispatcher: reflection.require('openfl.events.EventDispatcher'),
    Event: reflection.require('starling.events.Event'),
  };
  ({
    FragmentFilter,
    PlayerListItem,
    BossFactory,
    BossComponent,
    Turret,
    TurretManager,
    WeaponManager,
    QueuePopupMessage,
    SoundManager,
    SoundObject,
    SoundLocator,

    PlayerList,
    FriendManager,
    ServiceRoomPreview,
    ServiceRoomSelector,
    ButtonQueue,
    ButtonPvPQuickMatch,
    QueueManager,
    QueueInfoHolder,

    Rectangle,
    BitmapFont,
    BitmapChar,
    BitmapData,
    Shape,
    Radar,
    RadarBlip,
    Polygon,
    StarlingButton,
    ShopItemBar,
    CreditBuyBox,
    CreditManager,
    Hud,
    TechTree,
    EliteTechPopupMenu,
    EliteTechIcon,
    TechLevelIcon,
    MapPlayer,
    MapDeathLine,
    PowerBar,
    TechBar,
    PlayerClanLogo,
    ClanClient,
    PvpManager,
    DominationManager,
    Drop,
    Matrix,
    Bitmap,
    ImageLoader,
    URLLoader,
    Sound,
    SoundChannel,
    SoundTransform,
    URLRequest,
    LoaderContext,
    Xml,
    TextureAtlas,
    Texture,
    PopupConfirmMessage,
    PopupMessage,
    TextureLocator,
    Image,
    Random,
    TextureManager,
    Mesh,
    MeshBatch,
    VertexData,
    IndexData,
    Text,
    MovieClip,
    Sprite,
    ParallaxManager,
    MissionView,
    ClanState,
    DailyReward,
    DailyView,
    DailyManager,
    MissionsList,
    IntroState,
    ScreenTextField,
    BlurFilter,
    ColorMatrixFilter,
    GlowFilter,
    ProjectileGun,
    Teleport,
    TweenMax,
    WarpJumpState,
    KilledPlayerState,
    RoamingState,
    PlayState,
    LandedHangar,
    LandedLore,
    LandedExplore,
    SelectTeamState,
    ReportState,
    LandedPaintShop,
    PaintButton,
    LandedState,
    GameStateMachine,
    Missile,
    Boomerang,
    MissileStuck,
    ProjectileStuck,
    ProjectileFactory,
    ProjectileManager,
    Heading,
    Ship,
    ProjectileBullet,
    Bouncing,
    Damage,
    DailyRewardMessage,
    DailyRewardChild,
    Beam,
    RibbonTrail,
    RibbonSegment,
    RibbonTrailPool,
    Emitter,
    Particle,
    Color,
    EmitterManager,
    CollectiveMeshBatch,
    StarMap,
    GameObject,
    Engine,
    BodyManager,
    Body,
    Boss,
    Spawner,
    BossManager,
    SpawnManager,
    ShipManager,
    AIResurect,
    EnemyShip,
    EmitterFactory,
    PlayerShip,
    Projectile,
    ToolTip,
    WrapText,
    Style,
    Clock,
    InstantState,
    InstantSplitting,
    PressButton,
    ShipFactory,
    PodState,
    SkinItem,
    SkinItemBaseStats,
    MenuSelectIcon,
    CreditPackageItem,
    ArtifactStat,
    ArtifactBox,
    Cargo,
    ArtifactSelector,
    PopupBuyMessage,
    ArtifactCargoBox,
    ArtifactState2,
    DisplayState,
    MenuHud,
    ArtifactOverview,
    Artifact,
    ArtifactFactory,
    BuyFlux,
    PayVault,
    StarlingCameraFocus,
    Point,
    Player,
    MD5,
    Room,
    GUID,
    StartSetup,
    TopPvPPlayersList,
    FadeScreen,
    WeaponSelector,
    HealthAndShield,
    MessageLog,
    SceneBase,
    TextFormat,
    StarlingTextField,
    NativeTextFormat,
    Quad,
    Command,
    Converger,
    MessagePackHandler,
    ShipSync,
    Weapon,
    Unit,
    TextManager,
    TextParticle,
    TextHandler,
    SceneStateMachine,
    AIStateMachine,
    AITeleport,
    ShipWarpJump,
    AIStateFactory,
    Box,
    CrewDisplayBox,
    ExploreArea,
    ExploreMap,
    ExploreState,
    GameScene,
    PlayerManager,
    QuickConnect,
    PlayerIOSDK,
    RegisterDialog2,
    LoginButton,
    LoginInput,
    Client,
    PlayerIORegistrationError,
    Localize,
    DisplayObjectContainer,
    StarlingStage,
    Starling,
    Login,
    Preload,
    LoadingBar,
    JoinRoomManager,
    JoinRoomLocator,
    RymdenRunt,
    Util,
    EmbeddedAssets,
    DataManager,
    DomOverlay,
    ChatInputText,
    DataLocator,
    InputText,
    TextEntry,
    TextBitmap,
    Connection,
    Message,
    PlayerIOError,
    PlayerIO,
    RecoverDialog,
    NativeEvent,
    NativeEventDispatcher,
    Event,
  } = resolved);
}
