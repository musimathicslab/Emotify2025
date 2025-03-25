import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContextSelectorComponent } from '../components/home/context-selector/context-selector.component';
import { SpotifyCallbackComponent } from '../components/login/spotify-callback/spotify-callback.component';
import { SpotifyLoginComponent } from '../components/login/spotify-login/spotify-login.component';
import { LastfmLoginComponent } from '../components/login/lastfm-login/lastfm-login.component';
import { IntroComponent } from '../components/login/intro/intro.component';
import { ProfilePageComponent } from '../components/profile/profile-page/profile-page.component';
import { AuthGuard } from '../guard/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/intro', pathMatch: 'full' },
  { path: 'login-lastfm', component: LastfmLoginComponent },
  { path: 'login', component: SpotifyLoginComponent },
  { path: 'callback-lastfm', component: IntroComponent },
  { path: 'intro', component: ContextSelectorComponent },
  { path: 'callback', component: SpotifyCallbackComponent },
  {
    path: 'profile',
    component: ProfilePageComponent,
    canActivate: [AuthGuard],
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
