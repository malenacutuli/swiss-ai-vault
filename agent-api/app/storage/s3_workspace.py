"""S3-based workspace storage for agent file operations"""
import logging
from pathlib import Path
from typing import List, Dict, Any
import boto3
from botocore.exceptions import ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)


class S3Workspace:
    """
    Manages file storage for agent runs using Exoscale S3-compatible storage.

    Each run has its own workspace: users/{user_id}/runs/{run_id}/
    """

    def __init__(self, user_id: str, run_id: str):
        """
        Initialize workspace for a specific user and run.

        Args:
            user_id: User ID
            run_id: Agent run ID
        """
        self.user_id = user_id
        self.run_id = run_id
        self.prefix = f"users/{user_id}/runs/{run_id}/"

        settings = get_settings()
        self.bucket = settings.s3_workspace_bucket

        # Initialize S3 client with Exoscale endpoint
        self.s3 = boto3.client(
            's3',
            endpoint_url=settings.s3_endpoint,  # Exoscale Geneva
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key
        )

        logger.info(f"Initialized S3 workspace: {self.prefix}")

    async def write_file(self, filepath: str, content: bytes) -> bool:
        """
        Write file to workspace.

        Args:
            filepath: Relative path within workspace
            content: File content as bytes

        Returns:
            True if successful
        """
        key = self.prefix + filepath

        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content
            )
            logger.info(f"Wrote file: {key} ({len(content)} bytes)")
            return True
        except ClientError as e:
            logger.error(f"Failed to write file {key}: {e}")
            return False

    async def read_file(self, filepath: str) -> bytes:
        """
        Read file from workspace.

        Args:
            filepath: Relative path within workspace

        Returns:
            File content as bytes

        Raises:
            FileNotFoundError: If file doesn't exist
        """
        key = self.prefix + filepath

        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            content = response['Body'].read()
            logger.info(f"Read file: {key} ({len(content)} bytes)")
            return content
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"File not found: {filepath}")
            logger.error(f"Failed to read file {key}: {e}")
            raise

    async def list_files(self, dirpath: str = "") -> List[Dict[str, Any]]:
        """
        List files in workspace directory.

        Args:
            dirpath: Optional subdirectory path

        Returns:
            List of file metadata dictionaries
        """
        prefix = self.prefix + dirpath

        try:
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix
            )

            files = []
            for obj in response.get('Contents', []):
                # Remove workspace prefix to get relative path
                relative_path = obj['Key'].replace(self.prefix, '')
                if relative_path:  # Skip empty paths
                    files.append({
                        'filepath': relative_path,
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat()
                    })

            logger.info(f"Listed {len(files)} files in {prefix}")
            return files
        except ClientError as e:
            logger.error(f"Failed to list files in {prefix}: {e}")
            return []

    async def delete_file(self, filepath: str) -> bool:
        """
        Delete file from workspace.

        Args:
            filepath: Relative path within workspace

        Returns:
            True if successful
        """
        key = self.prefix + filepath

        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            logger.info(f"Deleted file: {key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete file {key}: {e}")
            return False

    async def file_exists(self, filepath: str) -> bool:
        """
        Check if file exists in workspace.

        Args:
            filepath: Relative path within workspace

        Returns:
            True if file exists
        """
        key = self.prefix + filepath

        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            logger.error(f"Error checking file existence {key}: {e}")
            return False

    async def download_to_pod(self, local_path: Path):
        """
        Download entire workspace to local directory.

        Used by K8s jobs to sync workspace to pod.

        Args:
            local_path: Local directory path to download to
        """
        try:
            paginator = self.s3.get_paginator('list_objects_v2')
            page_iterator = paginator.paginate(Bucket=self.bucket, Prefix=self.prefix)

            file_count = 0
            for page in page_iterator:
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    # Calculate local file path
                    relative = key.replace(self.prefix, '')
                    if not relative:
                        continue

                    local_file = local_path / relative
                    local_file.parent.mkdir(parents=True, exist_ok=True)

                    # Download file
                    self.s3.download_file(self.bucket, key, str(local_file))
                    file_count += 1

            logger.info(f"Downloaded {file_count} files to {local_path}")
        except ClientError as e:
            logger.error(f"Failed to download workspace to pod: {e}")
            raise

    async def upload_from_pod(self, local_path: Path):
        """
        Upload files from local directory to workspace.

        Used by K8s jobs to sync changes back to S3.

        Args:
            local_path: Local directory path to upload from
        """
        try:
            file_count = 0
            for file_path in local_path.rglob('*'):
                if file_path.is_file():
                    # Calculate S3 key
                    relative = file_path.relative_to(local_path)
                    key = self.prefix + str(relative)

                    # Upload file
                    self.s3.upload_file(str(file_path), self.bucket, key)
                    file_count += 1

            logger.info(f"Uploaded {file_count} files from {local_path}")
        except ClientError as e:
            logger.error(f"Failed to upload workspace from pod: {e}")
            raise

    async def clear_workspace(self) -> int:
        """
        Delete all files in workspace.

        Returns:
            Number of files deleted
        """
        try:
            response = self.s3.list_objects_v2(Bucket=self.bucket, Prefix=self.prefix)
            objects = response.get('Contents', [])

            if not objects:
                return 0

            # Batch delete
            delete_keys = [{'Key': obj['Key']} for obj in objects]
            self.s3.delete_objects(
                Bucket=self.bucket,
                Delete={'Objects': delete_keys}
            )

            count = len(delete_keys)
            logger.info(f"Cleared workspace: deleted {count} files")
            return count
        except ClientError as e:
            logger.error(f"Failed to clear workspace: {e}")
            return 0
