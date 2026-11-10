import type {API,Raw} from '../api/types';
import {NativeUI} from '../ui/native';
import {artifactFitness} from './fitness';
export function installArtifactUI(api:API){
 const ui=new NativeUI(api);
 for(const [name,method] of [['core.artifact.ArtifactCargoBox','addToolTip'],['core.artifact.ArtifactBox','setArtifact']]){
  const prototype=api.cls(name)?.prototype;if(typeof prototype?.[method]!=='function')throw Error(`Missing ${name}.${method}`);
  api.after(prototype,method,function(){if(this.a?.revealed&&this.toolTip)this.toolTip.set_text(this.toolTip.s+`<br>Fitness: ${artifactFitness(this.a).toFixed(2)}`);});
 }
 const overview=api.cls('core.artifact.ArtifactOverview')!.prototype;
 api.after(overview,'chooseSorting',function(){
  const popup=this.getChildAt(this.get_numChildren()-1);if(!(popup instanceof (api.cls('core.artifact.ArtifactSorting') as any)))return;
  // Existing sorting dialog and callback; new options stay in its scroll body.
  popup.newRow();for(const [label,order] of [['Fitness high','fitnesshigh'],['Fitness low','fitnesslow']]){
   const button=ui.button(label,()=>popup.closeAndSort(order));ui.place(button,popup.nextX,popup.nextY,popup.mainBody);popup.nextX+=button.get_width()+20;
  }
 });
 api.around(overview,'onSort',function(next,order:string){
  if(order!=='fitnesshigh'&&order!=='fitnesslow')return next(order);
  this.chooseSortingButton.set_enabled(true);const direction=order==='fitnesshigh'?-1:1;
  this.p.artifacts.sort((a:Raw,b:Raw)=>Number(b.revealed)-Number(a.revealed)||(a.revealed?direction*(artifactFitness(a as any)-artifactFitness(b as any)):0));
  this.cargoContainer.removeChildren(0,-1,true);this.cargoBoxes.length=0;this.drawArtifactsInCargo();
 });
}
