from django import template
import json

register = template.Library()

@register.filter
def index(sequence, position):
    """Returns the item at the given index from a list."""
    try:
        return sequence[position]
    except (IndexError, TypeError):
        return ''
