import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
@Injectable({ providedIn: 'root' })
export class FeaturesApi {
  private readonly auth = inject(AuthService);
  catalog() {
    return this.auth.request('/admin/api/v1/features');
  }
  usage() {
    return this.auth.request('/admin/api/v1/usage');
  }
  change(key: string, body: unknown) {
    return this.auth.request('/admin/api/v1/features/' + encodeURIComponent(key) + '/update', body);
  }
  override(body: unknown) {
    return this.auth.request('/admin/api/v1/feature-overrides', body);
  }
  remove(id: string, body: unknown) {
    return this.auth.request(
      '/admin/api/v1/feature-overrides/' + encodeURIComponent(id) + '/remove',
      body,
    );
  }
  limit(id: string, action: string, body: unknown) {
    return this.auth.request('/admin/api/v1/usage/' + encodeURIComponent(id) + '/' + action, body);
  }
  effective(id: string) {
    return this.auth.request('/admin/api/v1/features/effective/' + encodeURIComponent(id));
  }
}
