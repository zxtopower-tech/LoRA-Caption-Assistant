"""
File utility functions for common filename operations.
"""


def extract_base_name(filename: str) -> str:
    """
    Extract base name from filename (without extension).

    Args:
        filename: The filename to process (e.g., "item_image01.jpg")

    Returns:
        The base name without extension (e.g., "item_image01")

    Examples:
        >>> extract_base_name("item_image01.jpg")
        'item_image01'
        >>> extract_base_name("photo.png")
        'photo'
        >>> extract_base_name("archive.tar.gz")
        'archive.tar'
        >>> extract_base_name("noextension")
        'noextension'
    """
    last_dot_index = filename.rfind('.')
    if last_dot_index != -1:
        return filename[:last_dot_index]
    return filename


def extract_extension(filename: str) -> str:
    """
    Extract file extension from filename.

    Args:
        filename: The filename to process (e.g., "item_image01.jpg")

    Returns:
        The extension without dot (e.g., "jpg")

    Examples:
        >>> extract_extension("item_image01.jpg")
        'jpg'
        >>> extract_extension("photo.png")
        'png'
        >>> extract_extension("noextension")
        ''
    """
    last_dot_index = filename.rfind('.')
    if last_dot_index != -1:
        return filename[last_dot_index + 1:]
    return ""
