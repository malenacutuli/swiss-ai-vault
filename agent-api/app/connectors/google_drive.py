"""
Google Drive Connector - Full Google Drive API integration

Operations:
- Files: list, get, create, update, delete, copy
- Folders: create, list contents
- Sharing: create permissions, list permissions
- Export: export to different formats
- Search: search files by query
"""

import logging
from typing import Any, Dict, List, Optional
import base64

from app.connectors.base import BaseConnector, ConnectorResult, ConnectorCredentials

logger = logging.getLogger(__name__)


class GoogleDriveConnector(BaseConnector):
    """Google Drive API connector"""

    PROVIDER = "google_drive"
    BASE_URL = "https://www.googleapis.com"

    # MIME types for Google Workspace documents
    MIME_TYPES = {
        "folder": "application/vnd.google-apps.folder",
        "document": "application/vnd.google-apps.document",
        "spreadsheet": "application/vnd.google-apps.spreadsheet",
        "presentation": "application/vnd.google-apps.presentation",
        "form": "application/vnd.google-apps.form",
        "drawing": "application/vnd.google-apps.drawing",
    }

    # Export formats for Google Workspace documents
    EXPORT_FORMATS = {
        "document": {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt": "text/plain",
            "html": "text/html",
            "rtf": "application/rtf",
            "odt": "application/vnd.oasis.opendocument.text",
        },
        "spreadsheet": {
            "pdf": "application/pdf",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv",
            "ods": "application/vnd.oasis.opendocument.spreadsheet",
        },
        "presentation": {
            "pdf": "application/pdf",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "txt": "text/plain",
            "odp": "application/vnd.oasis.opendocument.presentation",
        },
    }

    def _get_auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.credentials.access_token}",
            "Accept": "application/json",
        }

    async def test_connection(self) -> ConnectorResult:
        """Test Google Drive connection by fetching about info"""
        result = await self._request("GET", "/drive/v3/about", params={"fields": "user"})
        if result.success:
            await self._update_last_used()
        return result

    # =========================================================================
    # FILE OPERATIONS
    # =========================================================================

    async def list_files(
        self,
        query: Optional[str] = None,
        page_size: int = 100,
        page_token: Optional[str] = None,
        order_by: str = "modifiedTime desc",
        fields: str = "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)",
    ) -> ConnectorResult:
        """List files in Drive"""
        params = {
            "pageSize": page_size,
            "orderBy": order_by,
            "fields": fields,
        }
        if query:
            params["q"] = query
        if page_token:
            params["pageToken"] = page_token

        return await self._request("GET", "/drive/v3/files", params=params)

    async def get_file(
        self,
        file_id: str,
        fields: str = "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, owners, permissions",
    ) -> ConnectorResult:
        """Get file metadata"""
        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}",
            params={"fields": fields},
        )

    async def get_file_content(
        self,
        file_id: str,
    ) -> ConnectorResult:
        """Download file content (for non-Google Workspace files)"""
        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}",
            params={"alt": "media"},
        )

    async def create_file(
        self,
        name: str,
        content: Optional[str] = None,
        mime_type: Optional[str] = None,
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> ConnectorResult:
        """Create a new file"""
        metadata = {"name": name}
        if mime_type:
            metadata["mimeType"] = mime_type
        if parent_id:
            metadata["parents"] = [parent_id]
        if description:
            metadata["description"] = description

        if content:
            # For simple text content, use multipart upload
            # This is a simplified version - full implementation would handle binary
            return await self._request(
                "POST",
                "/upload/drive/v3/files",
                params={"uploadType": "multipart"},
                json=metadata,
                # Note: Full implementation needs proper multipart handling
            )
        else:
            # Metadata-only creation (for folders or Google Workspace docs)
            return await self._request(
                "POST",
                "/drive/v3/files",
                json=metadata,
            )

    async def update_file(
        self,
        file_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        add_parents: Optional[str] = None,
        remove_parents: Optional[str] = None,
    ) -> ConnectorResult:
        """Update file metadata"""
        data = {}
        if name:
            data["name"] = name
        if description:
            data["description"] = description

        params = {}
        if add_parents:
            params["addParents"] = add_parents
        if remove_parents:
            params["removeParents"] = remove_parents

        return await self._request(
            "PATCH",
            f"/drive/v3/files/{file_id}",
            params=params if params else None,
            json=data,
        )

    async def delete_file(self, file_id: str) -> ConnectorResult:
        """Delete a file (move to trash)"""
        return await self._request(
            "DELETE",
            f"/drive/v3/files/{file_id}",
        )

    async def copy_file(
        self,
        file_id: str,
        name: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> ConnectorResult:
        """Copy a file"""
        data = {}
        if name:
            data["name"] = name
        if parent_id:
            data["parents"] = [parent_id]

        return await self._request(
            "POST",
            f"/drive/v3/files/{file_id}/copy",
            json=data,
        )

    async def export_file(
        self,
        file_id: str,
        mime_type: str,
    ) -> ConnectorResult:
        """Export a Google Workspace document to a different format"""
        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}/export",
            params={"mimeType": mime_type},
        )

    # =========================================================================
    # FOLDER OPERATIONS
    # =========================================================================

    async def create_folder(
        self,
        name: str,
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> ConnectorResult:
        """Create a new folder"""
        metadata = {
            "name": name,
            "mimeType": self.MIME_TYPES["folder"],
        }
        if parent_id:
            metadata["parents"] = [parent_id]
        if description:
            metadata["description"] = description

        return await self._request(
            "POST",
            "/drive/v3/files",
            json=metadata,
        )

    async def list_folder_contents(
        self,
        folder_id: str = "root",
        page_size: int = 100,
        page_token: Optional[str] = None,
        order_by: str = "folder,name",
    ) -> ConnectorResult:
        """List contents of a folder"""
        query = f"'{folder_id}' in parents and trashed = false"
        return await self.list_files(
            query=query,
            page_size=page_size,
            page_token=page_token,
            order_by=order_by,
        )

    # =========================================================================
    # SEARCH OPERATIONS
    # =========================================================================

    async def search_files(
        self,
        query: str,
        page_size: int = 100,
        page_token: Optional[str] = None,
    ) -> ConnectorResult:
        """Search files by name or content"""
        # Construct Drive API query
        search_query = f"name contains '{query}' or fullText contains '{query}'"
        search_query += " and trashed = false"

        return await self.list_files(
            query=search_query,
            page_size=page_size,
            page_token=page_token,
        )

    async def search_by_type(
        self,
        mime_type: str,
        page_size: int = 100,
        page_token: Optional[str] = None,
    ) -> ConnectorResult:
        """Search files by MIME type"""
        query = f"mimeType = '{mime_type}' and trashed = false"
        return await self.list_files(
            query=query,
            page_size=page_size,
            page_token=page_token,
        )

    # =========================================================================
    # SHARING/PERMISSION OPERATIONS
    # =========================================================================

    async def list_permissions(
        self,
        file_id: str,
        fields: str = "permissions(id, type, role, emailAddress, displayName)",
    ) -> ConnectorResult:
        """List permissions for a file"""
        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}/permissions",
            params={"fields": fields},
        )

    async def create_permission(
        self,
        file_id: str,
        role: str,  # owner, organizer, fileOrganizer, writer, commenter, reader
        permission_type: str,  # user, group, domain, anyone
        email_address: Optional[str] = None,
        domain: Optional[str] = None,
        send_notification_email: bool = True,
        email_message: Optional[str] = None,
    ) -> ConnectorResult:
        """Create a permission (share a file)"""
        data = {
            "role": role,
            "type": permission_type,
        }
        if email_address:
            data["emailAddress"] = email_address
        if domain:
            data["domain"] = domain

        params = {
            "sendNotificationEmail": send_notification_email,
        }
        if email_message:
            params["emailMessage"] = email_message

        return await self._request(
            "POST",
            f"/drive/v3/files/{file_id}/permissions",
            params=params,
            json=data,
        )

    async def update_permission(
        self,
        file_id: str,
        permission_id: str,
        role: str,
    ) -> ConnectorResult:
        """Update a permission"""
        return await self._request(
            "PATCH",
            f"/drive/v3/files/{file_id}/permissions/{permission_id}",
            json={"role": role},
        )

    async def delete_permission(
        self,
        file_id: str,
        permission_id: str,
    ) -> ConnectorResult:
        """Delete a permission (unshare)"""
        return await self._request(
            "DELETE",
            f"/drive/v3/files/{file_id}/permissions/{permission_id}",
        )

    async def transfer_ownership(
        self,
        file_id: str,
        email_address: str,
    ) -> ConnectorResult:
        """Transfer file ownership to another user"""
        return await self.create_permission(
            file_id=file_id,
            role="owner",
            permission_type="user",
            email_address=email_address,
            send_notification_email=True,
        )

    # =========================================================================
    # COMMENT OPERATIONS
    # =========================================================================

    async def list_comments(
        self,
        file_id: str,
        page_size: int = 100,
        page_token: Optional[str] = None,
        fields: str = "comments(id, content, author, createdTime, modifiedTime, resolved)",
    ) -> ConnectorResult:
        """List comments on a file"""
        params = {
            "pageSize": page_size,
            "fields": f"nextPageToken, {fields}",
        }
        if page_token:
            params["pageToken"] = page_token

        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}/comments",
            params=params,
        )

    async def create_comment(
        self,
        file_id: str,
        content: str,
    ) -> ConnectorResult:
        """Create a comment on a file"""
        return await self._request(
            "POST",
            f"/drive/v3/files/{file_id}/comments",
            json={"content": content},
        )

    async def update_comment(
        self,
        file_id: str,
        comment_id: str,
        content: str,
    ) -> ConnectorResult:
        """Update a comment"""
        return await self._request(
            "PATCH",
            f"/drive/v3/files/{file_id}/comments/{comment_id}",
            json={"content": content},
        )

    async def delete_comment(
        self,
        file_id: str,
        comment_id: str,
    ) -> ConnectorResult:
        """Delete a comment"""
        return await self._request(
            "DELETE",
            f"/drive/v3/files/{file_id}/comments/{comment_id}",
        )

    async def resolve_comment(
        self,
        file_id: str,
        comment_id: str,
    ) -> ConnectorResult:
        """Resolve a comment"""
        return await self._request(
            "PATCH",
            f"/drive/v3/files/{file_id}/comments/{comment_id}",
            json={"resolved": True},
        )

    # =========================================================================
    # REVISION OPERATIONS
    # =========================================================================

    async def list_revisions(
        self,
        file_id: str,
        page_size: int = 100,
        page_token: Optional[str] = None,
    ) -> ConnectorResult:
        """List revisions of a file"""
        params = {
            "pageSize": page_size,
            "fields": "nextPageToken, revisions(id, modifiedTime, lastModifyingUser, size)",
        }
        if page_token:
            params["pageToken"] = page_token

        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}/revisions",
            params=params,
        )

    async def get_revision(
        self,
        file_id: str,
        revision_id: str,
    ) -> ConnectorResult:
        """Get a specific revision"""
        return await self._request(
            "GET",
            f"/drive/v3/files/{file_id}/revisions/{revision_id}",
        )

    # =========================================================================
    # ABOUT/QUOTA OPERATIONS
    # =========================================================================

    async def get_about(self) -> ConnectorResult:
        """Get information about the user and their Drive"""
        return await self._request(
            "GET",
            "/drive/v3/about",
            params={"fields": "user, storageQuota, maxUploadSize"},
        )

    async def get_storage_quota(self) -> ConnectorResult:
        """Get storage quota information"""
        return await self._request(
            "GET",
            "/drive/v3/about",
            params={"fields": "storageQuota"},
        )

    # =========================================================================
    # SHARED DRIVE OPERATIONS
    # =========================================================================

    async def list_shared_drives(
        self,
        page_size: int = 100,
        page_token: Optional[str] = None,
    ) -> ConnectorResult:
        """List shared drives"""
        params = {
            "pageSize": page_size,
        }
        if page_token:
            params["pageToken"] = page_token

        return await self._request(
            "GET",
            "/drive/v3/drives",
            params=params,
        )

    async def get_shared_drive(
        self,
        drive_id: str,
    ) -> ConnectorResult:
        """Get shared drive details"""
        return await self._request(
            "GET",
            f"/drive/v3/drives/{drive_id}",
        )
